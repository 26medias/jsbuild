var toolset 	= require('toolset');
var prompt 		= require('prompt');
var colors 		= require('colors');
var _ 			= require('underscore');
var targz 		= require('tar.gz');
var lingo 		= require('lingo');
var path		= require('path');
var builder		= require('./builder');

colors.setTheme({
	silly: 'rainbow',
	input: 'grey',
	verbose: 'cyan',
	prompt: 'grey',
	info: 'green',
	data: 'grey',
	help: 'cyan',
	warn: 'yellow',
	debug: 'blue',
	error: 'red'
});


var sbuild = function() {
	this.file = {
		credentials:	__dirname+'/../data/storage/profile.dat'
	};
	
}
sbuild.prototype.init = function() {
	
	this.asciiart = {
		sbuild:	[
			"     _           _ _     _ ",
			" ___| |__  _   _(_) | __| |",
			"/ __| '_ \\| | | | | |/ _` |",
			"\\__ \\ |_) | |_| | | | (_| |",
			"|___/_.__/ \\__,_|_|_|\\__,_|",
			"             version "+this.version+" "
		],
		files:	[
			"  __ _ _           ",
			" / _(_) | ___  ___ ",
			"| |_| | |/ _ \\/ __|",
			"|  _| | |  __/\\__ \\",
			"|_| |_|_|\\___||___/",
			"                   "
		],
		status:	[
			"     _        _             ",
			" ___| |_ __ _| |_ _   _ ___ ",
			"/ __| __/ _` | __| | | / __|",
			"\\__ \\ || (_| | |_| |_| \\__ \\",
			"|___/\\__\\__,_|\\__|\\__,_|___/",
			"                            "
		]
	};
};
sbuild.prototype.displayArt = function(name, color) {
	if (!color) {
		color = 'help';
	}
	_.each(this.asciiart[name], function(line) {
		console.log(line[color]);
	});
}
sbuild.prototype.build = function() {
	var scope = this;
	// get the login data
	this.getLoginData(function(loginData) {
		var filename = scope.directory+"/build.json";
		
		toolset.file.exists(filename, function(exists) {
			if (!exists) {
				console.log("");
				console.log("This doesn't seem to be a sbuild project.".error);
				console.log("the file ".error+"build.json".warn+" is not present in your current directory.".error);
				console.log("Use"+" sbuild create".data+" to create a new project.");
				return false;
			}
			
			toolset.file.toObject(filename, function(data) {
				if (!data) {
					console.log("");
					console.log("Your build.json file is not valid JSON. Please fix that file and retry.".error);
					console.log("Filename: ",filename);
					console.log("data: ",data);
					return false;
				}
				scope.displayArt('sbuild');
				var b = new builder({
					directory:	scope.directory,
					file:		filename,
					user:		loginData
				});
				b.build();
			});
		});
	});
}
sbuild.prototype.getLoginData = function(callback) {
	var scope = this;
	toolset.file.exists(this.file.credentials, function(exists) {
		if (exists === true) {
			toolset.file.toObject(scope.file.credentials, function(obj) {
				if (!obj || !obj.name || !obj.email) {
					scope.login(callback);
				} else {
					console.log("\nWelcome back, "+obj.name.info+"!");
					callback(obj);
				}
			});
		} else {
			scope.login(callback);
		}
	});
}
sbuild.prototype.login = function(callback, message) {
	var scope = this;
	
	prompt.start()
	prompt.message = "";
	prompt.delimiter = "";
	
	if (!message) {
		message = [
			"",
			"You are not logged in yet.".info,
			"Please identify yourself",
			"Your data will be included in the build log.",
			"",
			"We will only ask you for this once, until you decide to logout.",
			""
		];
	}
	
	_.each(message, function(msg) {
		console.log(msg);
	});
	
	var prompts = {
		properties: {
			name: {
				message: 'Invalid format.',
				description: "Name:",
				required: true
			},
			email: {
				message: 'Invalid format.',
				description: "Email:",
				required: true
			}
		}
	};
	
	prompt.get(prompts, function (err, result) {
		if (result && result.name && result.email) {
			// Try to login
			scope.verifyCredentials(result, function(response){
				if (!response) {
					// Credentials do not match :(
					/// Try to login again
					scope.login(callback, [
						'',
						'Oops!'.error,
						'We were unable to identify you.',
						''
					]);
				} else {
					// All good!
					// Let's greet the user
					console.log("\nWelcome, "+response.name+"!\n".info);
					// Let's save that and keep going
					scope.writeEncrypted(response, callback);
				}
			});
		} else {
			console.log("Canceled".error);
		}
		
	});
}
sbuild.prototype.writeEncrypted = function(data, callback) {
	toolset.file.write(this.file.credentials, JSON.stringify(data, null, 4), callback);
}
sbuild.prototype.verifyCredentials = function(credentials, callback) {
	callback(credentials);
}
sbuild.prototype.logout = function(callback) {
	toolset.file.removeFile(this.file.credentials, callback);
}
module.exports = new sbuild();