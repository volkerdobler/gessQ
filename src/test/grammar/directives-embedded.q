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
