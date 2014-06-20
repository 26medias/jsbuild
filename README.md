# sBuild - Static Builder CLI #

A CLI to build static javascript and less/css libraries.

On the first use, the CLI will ask to identify the user.
His identity will be remembered indefinitely until the command `jsbuild logout` is executed.

The developer's identity will be logged and included in the build file.

## Installation ##

    npm install -g sbuild

## Usage ##

This utility is really and fast easy to use.

### Create a new project ###

    sbuild create


### Build ###

    sbuild build


**Output Example**
```
     _           _ _     _
 ___| |__  _   _(_) | __| |
/ __| '_ \| | | | | |/ _` |
\__ \ |_) | |_| | | | (_| |
|___/_.__/ \__,_|_|_|\__,_|
             version 0.0.1

Build finished without error in 340ms.
+-----------------------------------+
¦ Dev  ¦ build\pagevamp-sdk.dev.js  ¦
¦      ¦ build\pagevamp-sdk.dev.css ¦
+------+----------------------------¦
¦ Prod ¦ build\pagevamp-sdk.min.js  ¦
¦      ¦ build\pagevamp-sdk.min.css ¦
+-----------------------------------+
```

### Status ###
Returns the project's status.

    sbuild status

**Output Example**
```
     _        _
 ___| |_ __ _| |_ _   _ ___
/ __| __/ _` | __| | | / __|
\__ \ || (_| | |_| |_| \__ \
|___/\__\__,_|\__|\__,_|___/

+-----------------------------+
¦ Project Name ¦ Pagevamp SDK ¦
+--------------+--------------¦
¦ Version      ¦ 1.0.0        ¦
+--------------+--------------¦
¦ Output       ¦ ./build      ¦
+-----------------------------+
  __ _ _
 / _(_) | ___  ___
| |_| | |/ _ \/ __|
|  _| | |  __/\__ \
|_| |_|_|\___||___/

+------------------------+
¦ 1 ¦ ./engine/engine.js ¦
+---+--------------------¦
¦ 2 ¦ ./sdk/sdk.js       ¦
+---+--------------------¦
¦ 3 ¦ ./sdk/test.less    ¦
+------------------------+
```