// SYNTAX TEST "source.gessQ"

#include "other.q"
// <- entity.other.attribute-name.gessQ

#macro mymacro
// <- entity.other.attribute-name.gessQ

#endmacro
// <- entity.other.attribute-name.gessQ

#domacro mymacro
// <- entity.other.attribute-name.gessQ

javascript = "
QDot.onSubmit = function () { return false; };
// <- meta.embedded.block.javascript
";

css = "
.qtitle { color: red; }
// <- meta.embedded.block.css
";

title = "<b>Fett</b>";
//        ^ meta.embedded.block.html

// Q.'s \" inside an embedded block is one escape token, so the embedded
// html/js/css grammar never sees a bare quote (it used to open a JS string,
// break the nesting and swallow the closing "; and everything after it).
htmlPostText = "<script>setTimeout(\"go();\", 1000);</script>";
//                                 ^^ constant.character.escape.gessQ
//                                        ^^ constant.character.escape.gessQ
singleq q2;
// <- keyword.gessQ

javascript = "
x = \"a\";
//  ^^ meta.embedded.block.javascript constant.character.escape.gessQ
";

css = "
.a::before { content: \"x\"; }
//                    ^^ meta.embedded.block.css constant.character.escape.gessQ
";
