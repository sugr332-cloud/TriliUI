import test from "node:test";
import assert from "node:assert/strict";
import { githubUrl } from "../github-browser.mjs";

test("only GitHub HTTPS can be top-level navigated", () => {
  assert.equal(githubUrl("https://github.com/sugr332-cloud/TriliUI"),"https://github.com/sugr332-cloud/TriliUI");
  for (const bad of ["http://github.com","https://gist.github.com/","https://github.com.evil.test/","https://localhost/","file:///etc/passwd","https://user:pass@github.com/", "javascript:alert(1)"]) {
    assert.equal(githubUrl(bad),null,bad);
  }
});
