var toolset 	= require('toolset');
var prompt 		= require('prompt');
var colors 		= require('colors');
var _ 			= require('underscore');
var path		= require('path');
var minify		= require('minify');
var less 		= require('less');
var compressor	= require('node-minify');
var table 		= require('cli-table');

var builder = function(options) {
	this.options	= options;
	this.data		= {};	// placeholder for build.json data
}
builder.prototype.build = function(versionType) {
	var scope 	= this;
	
	this.filesContent = [];
	
	var timeStart = new Date().getTime();
	
	if (!versionType) {
		versionType = 'build';
	}
	
	// Get the conf file (build.json)
	this.getConf(function() {
		// Create the output path
		toolset.file.createPath(path.normalize(scope.options.directory+'/'+scope.data.output+'/'), function() {
			var stack = new toolset.stack();
			// Parse each file one by one, to parse them if necessary (less->css)
			_.each(scope.data.files, function(file) {
				stack.add(function(p, cb) {
					scope.processFile(file, function(fileContent, type) {
						scope.filesContent.push({
							filename:	file,
							type:		type,
							content:	fileContent
						});
						cb();
					});
				});
			});
			
			// Update the build number
			scope.incrementVersion(versionType, function(versions) {
				
				stack.process(function() {
					
					var processStack = new toolset.stack();
					var concat = {};
					
					// Concat the files in order, by type
					_.each(scope.filesContent, function(fileData) {
						if (!concat[fileData.type]) {
							concat[fileData.type] = "";
						}
						concat[fileData.type] += fileData.content;
					});
					
					var buildResult = {
						dev:	[],
						prod:	[]
					};
					
					// Write and post-process the files
					var ext;
					for (ext in concat) {
						processStack.add(function(p, cb) {
							// get the data
							var filename 	= path.basename(scope.data.filename, path.extname(scope.data.filename));
							var tempFilename= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'.tmp'+p.ext));
							var outputDev	= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'-'+versions.new+'.dev'+p.ext));
							var outputProdV	= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'-'+versions.new+'.min'+p.ext));
							var outputProd	= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'.min.latest'+p.ext));
							console.log("tempFilename",tempFilename);
							// Save the versions
							buildResult.dev.push(path.relative(scope.options.directory, outputDev));
							buildResult.prod.push(path.relative(scope.options.directory, outputProd));
							
							// Save the file, uncompressed
							toolset.file.write(outputDev, concat[p.ext], function() {
								// Post-process the files if necessary
								switch (p.ext) {
									case ".js":
										// Minify
										toolset.file.exists(outputDev, function(exists) {
											if (exists) {
												new compressor.minify({
													type: 		'yui-js',
													fileIn: 	outputDev,
													fileOut: 	tempFilename,
													callback: 	function(err, min){
														if (err) {
														} else {
															min = scope.getOutputheader(versions.new)+min;
															scope.saveAs([outputProd, outputProdV], min, function() {
																toolset.file.removeFile(tempFilename, function() {
																	cb();
																});
															});
														}
													}
												});
											} else {
												console.log("File "+outputDev+" *DOT NOT* exists.");
											}
										});
										
									break;
									case ".css":
										// Minify
										toolset.file.exists(outputDev, function(exists) {
											if (exists) {
												new compressor.minify({
													type: 		'yui-css',
													fileIn: 	outputDev,
													fileOut: 	tempFilename,
													callback: 	function(err, min){
														if (err) {
														} else {
															min = scope.getOutputheader(versions.new)+min;
															scope.saveAs([outputProd, outputProdV], min, function() {
																toolset.file.removeFile(tempFilename, function() {
																	cb();
																});
															});
														}
													}
												});
											} else {
												console.log("File "+outputDev+" *DOT NOT* exists.");
											}
										});
										
									break;
									default:
										cb();
									break;
								}
							});
							
							
							
						}, {ext:ext});
					}
					
					processStack.process(function() {
						
						// Update the build log
						scope.updateBuildLog(versions.new, function() {
							// Check how long it took.
							var timeEnd		= new Date().getTime();
							
							var duration	= timeEnd-timeStart;
							
							var tOutput = new table();
							tOutput.push(
								['Dev', buildResult.dev.join('\n')],
								['Prod', buildResult.prod.join('\n')]
							);
							
							var tVersion = new table();
							tVersion.push(
								['Previous version', 	versions.previous],
								['New version', 		versions.new]
							);
							
							console.log("");
							console.log("Build finished without error in ".info+(duration+"ms").help+".".info);
							console.log("");
							
							console.log(tOutput.toString());
							console.log(tVersion.toString());
						});
						
					}, false);
				}, false);
			});
		});
	});
	
};
builder.prototype.getOutputheader = function(version) {
	
	var t = new table();
	t.push(
		['Name', 				this.data.name],
		['version', 			version],
		['Last modified on', 	new Date().toISOString()],
		['Last modified by', 	this.options.user.name+' <'+this.options.user.email+'>']
	);
	
	return '/*\n'+(this.data.header?this.data.header+'\n':'')+t.toString().replace(/\u001b\[(?:\d*;){0,2}\d*m/g,'')+'\n*/\n';
}

builder.prototype.processFile = function(file, cb) {
	var scope 	= this;
	var ext 	= path.extname(file);
	
	toolset.file.read(file, function(content) {
		switch (ext) {
			case ".less":
				// Parse to Css
				scope.lessToCss(content, function(css) {
					cb(css, '.css');
				});
			break;
			case ".css":
				cb(content, '.css');
			break;
			case ".js":
				cb(content, '.js');
			break;
			default:
				cb(content, ext);
			break;
		}
	});
}


builder.prototype.lessToCss = function(lessContent, cb) {
	var parser = new less.Parser({
		paths         : [path.normalize(this.options.directory+'/'+this.data.output)],	// .less file search paths
		optimization  : 1,			// optimization level, higher is better but more volatile - 1 is a good value
	});
	parser.parse(lessContent, function (error, cssTree) {
		var cssString = cssTree.toCSS({
			compress:		true,
			yuicompress:	true
		});
		cb(cssString);
	});
};

builder.prototype.getConf = function(cb) {
	var scope 	= this;
	
	toolset.file.toObject(this.options.file, function(data) {
		// Fix the object, for missing properties
		if (!data.buildlog) {
			data.buildlog = [];
		}
		scope.data = data;
		cb();
	});
};

builder.prototype.incrementVersion = function(type, cb) {
	var scope 	= this;
	
	if (this.data.version[type] == undefined) {
		this.data.version[type] = 0;
	}
	
	var currentVersion = [this.data.version.major,this.data.version.minor,this.data.version.build].join('.');
	
	// Reset the proper subversions
	switch (type) {
		case "major":
			this.data.version.minor = 0;
			this.data.version.build = 0;
		break;
		case "minor":
			this.data.version.build = 0;
		break;
	}
	
	this.data.version[type]++;
	
	var newVersion = [this.data.version.major,this.data.version.minor,this.data.version.build].join('.');
	
	// Write the changes
	toolset.file.writeJson(this.options.file, this.data, function() {
		cb({
			previous:	currentVersion,
			new:		newVersion
		});
	}, true);
};

builder.prototype.updateBuildLog = function(version, cb) {
	var scope 	= this;
	
	this.data.buildlog.push({
		date:		new Date().toISOString(),
		author:		this.options.user,
		version:	version
	});
	
	// Write the changes
	toolset.file.writeJson(this.options.file, this.data, function() {
		cb();
	}, true);
};
builder.prototype.saveAs = function(names, content, callback) {
	var scope 	= this;
	var stack = new toolset.stack();
	
	_.each(names, function(name) {
		stack.add(function(p, cb) {
			toolset.file.write(name, content, function() {
				cb();
			}, true);
		});
	});
	
	stack.process(function() {
		callback();
	}, true);
};

module.exports = builder;