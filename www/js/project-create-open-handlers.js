function createProject(e) {
    var projectPath = $("#projectPath").text().trim();

    var projectName = $("#projectName").val().trim();
    var projectId = $("#project-id").val().trim() || $("#project-id").attr("placeholder").trim();

    var isProjectPathEmpty = isProjectPathFieldEmpty(projectPath);
    var isProjectNameEmpty = isEmptyField(projectName);
    var isValidIdentifier = require('valid-identifier')(projectId);

    var projDir = "";

    hideProjectPathError();
    hideProjectNameError();
    hideProjectIdError();
    resetProjectCreationFormHeight();

    if(!isProjectNameEmpty && !isProjectPathEmpty && isValidIdentifier) {
        projDir = projectPath + buildPathBasedOnOS("/") + projectName;
        localStorage.projDir = projDir;
        if(!projectExistsInLocalStorage(projDir)) {

            var oldPathToConfigFile = projectPath + buildPathBasedOnOS("/www/config.xml");
            var newPathToConfigFile = projectPath + buildPathBasedOnOS("/config.xml");

            fs.readFile(newPathToConfigFile, {encoding:'utf8'}, function(err, newPathData) {
                if (err) {
                    fs.readFile(oldPathToConfigFile, {encoding:'utf8'}, function(err, oldPathData) {
                        if (err) {
                            // if no www/config.xml found then create a new project
                            create(projectName, projectId, projDir);
                        } else {
                            displayPhoneGapProjectInFolderError();
                        }
                    });
                } else {
                    displayPhoneGapProjectInFolderError();
                }
            });
        } else {
            displayPhoneGapProjectInFolderError();
        }
    } else {

        if (isProjectPathEmpty) {
            // error with project path
            displayProjectPathError();
        }

        if (isProjectNameEmpty) {
            // error with project name
            displayProjectNameError();
        }

        if (!isValidIdentifier) {
            displayProjectIdError();
        }

        adjustProjectCreationFormHeight();
    }
}

function selectProjectPath(e) {
    global.createClicked = true;
    selectDirectory(e);
}

function openProject(e) {
    selectDirectory(e);
}

function selectDirectory(e) {
    global.projDir = undefined; // reset it for new value

    var projectDir = $("#projectDirectory").val().trim();
    var projectName = $("#projectName").val().trim();

    // If this came from drag-n-drop the project directory name will be
    // passed in there so use it
    if (global.isDragDrop && e != null) {
        projectDir = e;
    }

    var isProjectPathEmpty = isProjectPathFieldEmpty(projectDir);
    var isProjectNameEmpty = isEmptyField(projectName);

    if(global.createClicked) {
        // new project creation workflow
        global.createClicked = false;
        $("#projectPath").removeClass("overlay-form-item-description");
        $("#projectPath").removeClass("italics");
        hideProjectPathError();
        $("#projectPath").text(projectDir);
        $(".tooltiptext").text(projectDir);
        $("#projectName").focus();

        if(!projectExistsInLocalStorage(projectDir)) {

            var oldPathToConfigFile = projectDir + buildPathBasedOnOS("/www/config.xml");
            var newPathToConfigFile = projectDir + buildPathBasedOnOS("/config.xml");

            fs.readFile(newPathToConfigFile, {encoding:'utf8'}, function(err, newPathData) {
                if (err) {
                    fs.readFile(oldPathToConfigFile, {encoding:'utf8'}, function(err, oldPathData) {
                        if (err) {
                            // assume that no www/config.xml means a project doesn't exist in selected local path
                            hideProjectPathError();
                            resetProjectCreationFormHeight();
                        } else {
                            // www/config.xml exists in selected local path, assume that there is an existing project in the local path
                            displayPhoneGapProjectInFolderError();
                        }
                    });
                } else {
                    // config.xml exists in selected local path, assume that there is an existing project in the local path
                    displayPhoneGapProjectInFolderError();
                }
            });
        } else {
            // selected local path already exists in local storage, assume that there is an existing project in the local path
            displayPhoneGapProjectInFolderError();
        }
    } else {
        if (projectDir.length > 0) {
            // Drag drop workflow doesn't need these lines'
            if (!global.isDragDrop) {
                $("#overlay-bg").hide();
                hideAddCreateProjectOverlay();
                $("#plus-icon").attr("src", "img/icons/normal/plus.svg");
            }

            // open existing project workflow
            checkIfProjectConfigExists(projectDir);
        }
    }

    $("#projectDirectory").val("");
}

function create(projectName, projectId, projDir) {
    var options = {};
    options.path = projDir;
    options.name = projectName;
    options.id = projectId;
    options.verbose = true;

    var npmKey = $('input:checked[name="selectedTemplate"]').attr('data-key');

    var spawn = require('child_process').spawn;
    var path = require('path');

    // Use the node executable path for the command to invoke
    var node;
    if (process.platform == 'win32') {
        node = path.join(__dirname, 'bin', 'node.exe').replace('app.asar', 'app.asar.unpacked');
    }
    else {
        node = path.join(__dirname, 'bin', 'node');
    }

    // Define command arguments
    var args = [];
    args.push(path.join(__dirname, 'node_modules', 'phonegap', 'bin', 'phonegap.js').replace('app.asar', 'app.asar.unpacked'));
    args.push('create');
    args.push(options.path);
    args.push('--template');
    args.push(npmKey);
    args.push('--id');
    args.push(options.id);
    args.push('--name');
    args.push(options.name);

    // Define options
    var opts = [];
    opts.env = process.env;
    opts.stdio = ['ipc'];

    // spawn child process and include success/error callbacks
    var child = spawn(node, args, opts);
    showLoader(true, 'Creating Project...');

    child.on('close', function(code) {

        if (code === 0) {
            hideLoader();
            trackProjectCreated();

            createHandler(projectName, projectId, options.path);
            setLastSelectedProjectPath(options.path);
        }
    });
    child.on('message', function(e) {
        hideLoader();

        if (e.output) {
            displayErrorMessage(e.output);
            trackErrors({ message: e.output });
        } else {
            displayErrorMessage("Project create failed with code " + e.exitCode);
        }
    });
}

function createHandler(projectName, projectId, projDir) {
    // Removed updateConfig in favor of new readConfig since the config.xml file was already updated by the CLI
    // updateConfig(projectName, projectId, projDir);
    readConfig(projectName, projectId, projDir);
    hideProjectDetailsOverlay();
}

// Read the config.xml of the newly created project to get the version etc and invoke addProject
function readConfig(projName, projId, projDir) {
    var newPathToConfigFile = projDir + buildPathBasedOnOS("/config.xml");

    fs.readFile(newPathToConfigFile, {encoding: 'utf8'}, function(err, newPathData) {
        if(err) {
            displayMissingConfigFileNotification();
        } else {
            xmlDoc = $.parseXML(newPathData);
            $xml = $(xmlDoc);
            var projVersion = $xml.find("widget").attr("version")
            var iconPath = path.join(projDir, findIconPath($xml.find("icon")));
            addProject(projName, projVersion, iconPath, projDir);
        }
    });
}

function checkIfProjectConfigExists(projDir) {
    var oldPathToConfigFile = projDir + buildPathBasedOnOS("/www/config.xml");
    var newPathToConfigFile = projDir + buildPathBasedOnOS("/config.xml");

    fs.readFile(newPathToConfigFile, 'utf8', function(err, data) {
        if (err) {
            fs.readFile(oldPathToConfigFile, 'utf8', function(err, data) {
                if(err) {
                    displayMissingConfigFileNotification();

                } else {
                    parseProjectConfig(data, projDir);
                }
            });
        } else {
            parseProjectConfig(data, projDir);
        }
    });
}

function parseProjectConfig(data, projDir) {
    $.xmlDoc = $.parseXML(data);
    $.xml = $($.xmlDoc);

    // get the project name
    var projectName = $.xml.find("name").text();

    // get the project version
    var projectVersion = $.xml.find("widget").attr("version");

    // get the app icon
    var iconPath = path.join(projDir, findIconPath($.xml.find("icon")));

    // check if the project exists in PG-GUI's localstorage before adding
    if(!projectExistsInLocalStorage(projDir)) {
        // We're going to add it, take care of UI stuff
        addProject(projectName, projectVersion, iconPath, projDir);
        //toggleServerStatus(projDir);
        trackProjectOpened();
    } else {
        displayProjectExistsNotification();
    }
}

function displayMissingConfigFileNotification() {
    setNotificationText("Selected folder doesn't contain a config.xml file.");
    displayNotification();
}

function displayProjectExistsNotification() {
    setNotificationText("You tried to add a project that already exists. A duplicate has not been added.");
    displayNotification();
}

function projectExistsInLocalStorage(projDir) {

    var projectFound = false;

    if (localStorage.projects) {
        var projects = JSON.parse(localStorage.projects);
        var index = projects.length;

        for (var i=0;i<index;i++) {
            if(projDir == projects[i].projDir) {
                projectFound = true;
                break;
            }
        }
    }

    return projectFound;
}

function folderExistsInFileSystem(projDir) {
    var folder = buildPathBasedOnOS(projDir);
    fs.exists(folder, function(exists) {
        if (exists) {
            displayDuplicateProjectNameError();
            adjustProjectCreationFormHeight();
        } else {
            hideDuplicateProjectNameError();
            resetProjectCreationFormHeight();
        }
    });
}
