require.config({
    baseUrl: '.',
    paths: {
        'ts-events': 'ts-events'
    }
});

require(['ts-events'], function(tsEvents) {
	var e = new tsEvents.VoidSyncEvent();
	e.attach(function() {
		document.getElementById("syncevent").textContent = "Hi!";
	});
	e.post();
});
