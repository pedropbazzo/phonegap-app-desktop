function checkForUpdates() {

    var app = require('electron').remote.app;
    var jsonUrl = 'https://raw.githubusercontent.com/phonegap/phonegap-app-desktop/update-check/package.json';

    $.getJSON(jsonUrl).done(function(json) {
        var clientVersion = app.getVersion().toString();
        var serverVersion = JSON.stringify(json.version);
        serverVersion = serverVersion.replace(/["']/g, "");

        if (serverVersion > clientVersion) {
            $('#updateOverlayTitle').text('Update Available');
            $('#updateOverlayPrompt').text('A newer version of PhoneGap Desktop was found. Would you like PhoneGap Desktop to download the update & restart?');
            $("#overlay-bg").show();
            $('#updateOverlay').show();
        }
    })
    .fail(function(jqxhr, textStatus, error) {
        var err = textStatus + ", " + error;
        displayErrorMessage("Update check failed: " + err);
    });
}

function updateDesktopApp(updater) {
    var app = require('electron').remote.app;

    overlayBackgroundHandler();
    $('#updateOverlay').hide();

    //$('#loader-text').text('Update is in progress');
    //$('#loading-overlay').show();
    showLoader(true, 'Update is in progress');

    updater.on('error', function(err, msg) {
        $('#loading-overlay').hide();
        $('#loader-text').text('');
        displayErrorMessage('PhoneDesktop could not update because of the following error:\n\n' + msg);
    })
    .on('update-downloaded', function(err) {
        updater.quitAndInstall();
    })
    .on('update-not-available', function(err) {
        $('#loading-overlay').hide();
        $('#loader-text').text('');
    });

    // optional branch param can be used for testing
    //var feedUrl = 'http://localhost:8080/desktop/?platform=' + determineOperatingSystem() + '&version=' + app.getVersion();
    //var feedUrl = 'http://stage.update.api.phonegap.com/desktop/?platform=' + determineOperatingSystem() + '&version=' + app.getVersion();
    var feedUrl = 'http://update.api.phonegap.com/desktop/?platform=' + determineOperatingSystem() + '&version=' + app.getVersion();

    updater.setFeedURL(feedUrl);
    updater.checkForUpdates();
}
