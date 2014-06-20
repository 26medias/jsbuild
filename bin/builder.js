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
builder.prototype.build = function() {
	var scope 	= this;
	
	this.filesContent = [];
	
	var timeStart = new Date().getTime();
	
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
						var outputDev	= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'.dev'+p.ext));
						var outputProd	= path.relative(__dirname, path.normalize(scope.options.directory+'/'+scope.data.output+'/'+filename+'.min'+p.ext));
						
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
												fileOut: 	outputProd,
												callback: 	function(err, min){
													if (err) {
													} else {
														cb();
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
												fileOut: 	outputProd,
												callback: 	function(err, min){
													if (err) {
													} else {
														cb();
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
					
					// Check how long it took.
					
					var timeEnd		= new Date().getTime();
					
					var duration	= timeEnd-timeStart;
					
					var t = new table();
					t.push(
						['Dev', buildResult.dev.join('\n')],
						['Prod', buildResult.prod.join('\n')]
					);
					
					console.log("");
					console.log("Build finished without error in ".info+(duration+"ms").help+".".info);
					
					console.log(t.toString());
				}, true);
			}, false);
		});
	});
	
	
	
	
	/*
	// 1.	Split the files by type (and list the files using their full path for further processing)
	this.getConf(function() {
		scope.filetypes = scope.groupByType(scope.data.files);
		toolset.log("Files", scope.filetypes);
		// 2.	Concat by type
		scope.concat(function(concatList) {
			// 3.	Build the required files (including less->css)
			if (concatList['.less']) {
				var css = scope.lessToCss(concatList['.less'], function(cssContent) {
					/// If there was some css, concat
				});
				
			}
		});
	});
	*/
	
};

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

builder.prototype.concat = function(cb) {
	var scope = this;
	var ext;
	
	var stack = new toolset.stack();
	
	var concat = {};
	
	for (ext in scope.filetypes) {
		(function(ext) {
			_.each(scope.filetypes[ext], function(file) {
				switch (ext) {
					case ".js":
					case ".css":
					case ".less":
						if (!concat[ext]) {
							concat[ext] = "";
						}
						stack.add(function(p, cb) {
							toolset.file.read(file, function(content) {
								concat[ext] += "\n\n/* "+file+" */\n"+content;
								cb();
							});
						});
					break;
					default:
						// Nothing
					break;
				}
			});
		})(ext);
	}
	
	stack.process(function() {
		cb(concat);
	}, false);	// !async
	
}

builder.prototype.groupByType = function(files) {
	var scope = this;
	var types = {};
	
	_.each(files, function(file) {
		var ext = path.extname(file);
		if (!types[ext]) {
			types[ext] = [];
		}
		// Push the full filename, including full path
		types[ext].push(path.normalize(scope.options.directory+'/'+file));
	});
	
	return types;
};
builder.prototype.getConf = function(cb) {
	var scope 	= this;
	
	toolset.file.toObject(this.options.file, function(data) {
		scope.data = data;
		cb();
	});
};





// Save the current build data into the build.json file
builder.prototype.save = function() {
	
};

module.exports = builder;