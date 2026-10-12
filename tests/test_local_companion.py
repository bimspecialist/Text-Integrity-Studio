"""Offline companion tests; never invoke an actual model or third-party service."""
import importlib.util, io, json, pathlib, tempfile, threading, unittest, urllib.request, urllib.error, zipfile
from unittest.mock import patch
from http.server import ThreadingHTTPServer
f=pathlib.Path(__file__).resolve().parents[1]/"tools"/"local_companion.py"
spec=importlib.util.spec_from_file_location("local_companion",f)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class CompanionTests(unittest.TestCase):
 def test_reject_external_model_urls(self):
  with self.assertRaisesRegex(mod.CompanionError,"forbidden"):
   mod.local_proofread("This is a test",model_endpoint="https://provider.example/api/generate")
 def test_untrusted_model_name_rejected(self):
  with self.assertRaisesRegex(mod.CompanionError,"Invalid"):
   mod.local_proofread("Test",model="abc;curl")
 def test_preservation_prompt(self):
  text=mod.prompt_for_proofread("SBC 201 is 25% different.","ar")
  for term in ("25%","dates","citations","Do not fabricate","ar"):
   self.assertIn(term,text)
 def test_max_chars(self):
  with self.assertRaisesRegex(mod.CompanionError,"exceeds"):
   mod.local_proofread("hello"*9000)
 def test_review_is_non_destructive(self):
  with tempfile.TemporaryDirectory() as d:
   src=pathlib.Path(d)/"original.txt";src.write_text("teh test",encoding="utf8")
   target=pathlib.Path(d)/"review.txt"
   result=mod.save_review(src,"teh test","the test",target)
   self.assertEqual(src.read_text(encoding="utf8"),"teh test")
   self.assertEqual(target.read_text(encoding="utf8"),"the test")
   self.assertEqual(result["status"],"DRAFT_REQUIRES_REVIEW")
   with self.assertRaisesRegex(mod.CompanionError,"overwrite"):
    mod.save_review(src,"x","y",src)
 def test_docx_utf8_extract(self):
  with tempfile.TemporaryDirectory() as d:
   file=pathlib.Path(d)/"test.docx"
   xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>مرحبا</w:t></w:r></w:p></w:body></w:document>'
   with zipfile.ZipFile(file,"w") as z:z.writestr("word/document.xml",xml)
   self.assertEqual(mod.read_source(file),"مرحبا")
 def test_local_api_token_and_inconclusive_detector(self):
  token="localtesttoken"
  server=ThreadingHTTPServer(("127.0.0.1",0),mod.make_handler(token,"local-model"))
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  url="http://127.0.0.1:"+str(server.server_address[1])
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
  try:
   with opener.open(url+"/health",timeout=3) as r:
    self.assertEqual(json.load(r)["classifier"],"NOT VALIDATED")
   data=json.dumps({"text":"Private student text"}).encode()
   req=urllib.request.Request(url+"/v1/proofread",data=data,headers={"Content-Type":"application/json"},method="POST")
   with self.assertRaises(urllib.error.HTTPError) as err:opener.open(req,timeout=3)
   self.assertEqual(err.exception.code,401)
   req=urllib.request.Request(url+"/v1/detector",data=data,headers={"Authorization":"Bearer "+token},method="POST")
   with self.assertRaises(urllib.error.HTTPError) as err:opener.open(req,timeout=3)
   self.assertEqual(err.exception.code,503)
   self.assertIn("INCONCLUSIVE",err.exception.read().decode())
   with patch.object(mod,"local_proofread",return_value="Updated but review first") as mock:
    req=urllib.request.Request(url+"/v1/proofread",data=data,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"},method="POST")
    with opener.open(req,timeout=3) as r:body=json.load(r)
    self.assertEqual(body["status"],"DRAFT_REQUIRES_REVIEW")
    self.assertEqual(body["proposed_text"],"Updated but review first")
    mock.assert_called_once()
   req=urllib.request.Request(url+"/v1/proofread",data=data,headers={"Authorization":"Bearer "+token,"Origin":"https://example.test"},method="POST")
   with self.assertRaises(urllib.error.HTTPError) as err:opener.open(req,timeout=3)
   self.assertEqual(err.exception.code,403)
  finally:server.shutdown();server.server_close();thread.join(timeout=3)

if __name__=="__main__":unittest.main()
