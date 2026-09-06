textq scriptq;
text = "js + css block";
javascript = "
QDot.onSubmit = function () {
	startBackgroundAudioRecording('rec_@insert(_caseid)');
	return false;
};
var xs = [1, 2, 3];
xs.map(function (n) { return n.toFixed(2); });
";
css = "
.qtitle { text-align: center; }
.qopenfield { display: none; }
";
