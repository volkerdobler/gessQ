singleq folgefrage;
text = "Und welche kaufen Sie?";
labels = 1 "Audi" 2 "BMW" 10 "keine davon" single;
assert ( folgefrage eq 1 ) "" exit 2;

singleq nurjung;
text = "Nur wenn jung.";
flt = ( alter eq 2 );
labels = 1 "ja" 2 "nein";
