/* Complete private Express proxy example.
 * Dependencies: express, multer, jose. Existing issuer must sign scoped user JWTs.
 * Mount: app.use("/api", require("./express-authenticated-proxy"));
 */
'use strict';
const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: 6*1024*1024, files: 1, fields: 7 },
}).single('file');
const secret = process.env.TIS_SESSION_JWT_SECRET || '';
const key = process.env.TIS_API_KEY || '';
const api = 'http://127.0.0.1:8000/v1';
const origin = process.env.TIS_PUBLIC_ORIGIN || '';
function respond(res, status, data) {
  res.set('Cache-Control', 'no-store');
  return res.status(status).json(data);
}
async function authenticate(req, res, next) {
  if (secret.length < 32 || key.length < 32 || !origin)
    return respond(res, 503, { error: 'Server credentials missing' });
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return respond(res, 401, { error: 'Signed user session required' });
  try {
    const { jwtVerify } = await import('jose');
    const token = header.slice(7);
    const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'], issuer: 'tis-auth-service', audience: 'tis-detector',
    });
    if (typeof verified.payload.sub !== 'string' || !verified.payload.sub)
      throw Error('Missing account identity');
    req.authenticatedUserId = verified.payload.sub;
  } catch {
    return respond(res, 401, { error: 'Session expired or invalid' });
  }
  if (req.get('origin') && req.get('origin') !== origin)
    return respond(res, 403, { error: 'Origin forbidden' });
  next();
}
async function upstream(path, payload, multipart, res) {
  try {
    const headers = { 'X-API-Key': key };
    if (!multipart) headers['Content-Type'] = 'application/json';
    const response = await fetch(api + path, { method:'POST', headers,
      body: multipart ? payload : JSON.stringify(payload),
      redirect:'error', cache:'no-store', signal:AbortSignal.timeout(31000) });
    if (!(response.headers.get('content-type') || '').includes('application/json'))
      return respond(res, 502, { error: 'Unexpected upstream content type' });
    return respond(res, response.status, await response.json());
  } catch { return respond(res, 503, { error: 'Private detector unavailable' }); }
}
router.post('/detect', authenticate, express.json({ limit:'135kb' }), (req,res) => {
  const body=req.body;
  if (!body || typeof body.text !== 'string' || body.text.length > 120000)
    return respond(res,422,{error:'Invalid text'});
  return upstream('/analyze', body, false, res);
});
router.post('/detect/file', authenticate, (req,res,next)=>{
  const length=Number(req.get('content-length') || -1);
  if (length<0 || length>6*1024*1024+250000)
    return respond(res,413,{error:'File upload size exceeded'});
  upload(req,res,error=>{
    if(error) return respond(res,error.code==='LIMIT_FILE_SIZE'?413:422,{error:'Invalid upload'});
    next();
  });
},(req,res)=>{
  if(!req.file || !/\.(txt|pdf|docx)$/i.test(req.file.originalname))
    return respond(res,422,{error:'Supported PDF, DOCX or TXT required'});
  const form=new FormData();
  form.set('file',new Blob([req.file.buffer]),req.file.originalname);
  for(const key of ['language','domain','writing_context','segment_by','include_segments']) {
    if(typeof req.body?.[key]==='string') form.set(key,req.body[key]);
  }
  form.set('return_extracted_text','true');
  return upstream('/analyze-file',form,true,res);
});
module.exports=router;
