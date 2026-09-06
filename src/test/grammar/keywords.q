// SYNTAX TEST "source.gessQ"

singleq frage1;
// <- keyword.gessQ

multiq frage2;
// <- keyword.gessQ

flt = ( alter eq 2 );
// <- support.class.gessQ
//            ^^ support.class.gessQ

labels = 1 "Audi";
//       ^ constant.numeric.decimal
//         ^^^^^^ string.quoted.double.gessQ

// a line comment
// <- comment.gessQ
