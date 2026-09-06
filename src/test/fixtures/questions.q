singleq alter;
text = "Wie alt sind Sie?";
labels =
1 "unter 18"
2 "18 bis 29"
3 "30 bis 49"
4 "50 und älter"
;

opennumformat onf_pct = 1 2 0 2 0 100 0 "%";

block intro = ( alter );

multiq marken;
text = "Welche Marken kennen Sie?";
labels =
1 "Audi"
2 "BMW"
3 "Mercedes"
;

singleq zufrieden;
text = "Sind Sie zufrieden?";
flt = ( 2 in marken );
labels = 1 "ja" 2 "nein";
