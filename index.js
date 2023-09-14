#!/usr/bin/env node

const util = require("util");
const fs = require("fs");

const PATH_1 = process.argv[process.argv.length - 2];
const PATH_2 = process.argv[process.argv.length - 1];

const STAT_MODE_FOLDER = 16822;
const STAT_MODE_FILE = 33206;
const ERROR_CODE_ENOENT = "ENOENT";

console.log("sync-folders", PATH_1, PATH_2);

const stat = util.promisify(fs.stat);
const copyFile = util.promisify(fs.copyFile);
const rm = util.promisify(fs.rm);
const cp = util.promisify(fs.cp);

const processContent = async (srcPath, destPath, name) => {
  try {
    const srcParentStat = await stat(srcPath);
    const destParentStat = await stat(destPath);
    try {
      const srcStat = await stat(srcPath + "/" + name);
      if (srcStat.mode === STAT_MODE_FOLDER) {
        processFolder(srcPath, destPath, "/" + name, srcParentStat, destParentStat, srcStat);
      } else if (srcStat.mode === STAT_MODE_FILE) {
        processFile(srcPath, destPath, "/" + name, srcParentStat, destParentStat, srcStat);
      } else {
        console.log("unknown", { srcStat });
      }
    } catch (error) {
      deleteTarget(destPath + "/" + name);
    }
  } catch (error) {
    console.log("watch parent error", error);
    // TODO: do nothing. one of parent folders is deleted
  }
};

const startWatcher = async (srcPath, destPath) => {
  fs.watch(srcPath, { recursive: true }, async (event, name) => {
    processContent(srcPath, destPath, name);
  });

  try {
    const dir = fs.readdirSync(srcPath);
    dir.forEach(item => {
      processContent(srcPath, destPath, item);
    });
  } catch (error) {
    console.log("sync error", error);
  }
};

const processFile = async (srcParentPath, destParentPath, filePath, srcParentStat, destParentStat, srcFileStat) => {
  const isSrcParentNewer = srcParentStat.ctime > destParentStat.ctime;
  const isSrcParentOlder = srcParentStat.ctime < destParentStat.ctime;
  let isDestMissing = false;
  let isSrcNewer = false;
  try {
    const destFileStat = await stat(destParentPath + filePath);
    if (srcFileStat.ctime > destFileStat.ctime) {
      isSrcNewer = true;
    }
  } catch (error) {
    if (error.code === ERROR_CODE_ENOENT) {
      isDestMissing = true;
    }
  }

  if ((isDestMissing && isSrcParentNewer) || isSrcNewer) {
    copyFileContent(srcParentPath + filePath, destParentPath + filePath);
  } else if (isDestMissing && isSrcParentOlder) {
    deleteTarget(srcParentPath + filePath);
  }
};

const processFolder = async (srcParentPath, destParentPath, folderPath, srcParentStat, destParentStat, srcFolderStat) => {
  const isSrcParentNewer = srcParentStat.ctime > destParentStat.ctime;
  const isSrcParentOlder = srcParentStat.ctime < destParentStat.ctime;
  let isDestMissing = false;
  let isSrcNewer = false;

  try {
    const destFolderStat = await stat(destParentPath + folderPath);
    if (srcFolderStat.ctime > destFolderStat.ctime) {
      isSrcNewer = true;
    }
  } catch (error) {
    if (error.code === ERROR_CODE_ENOENT) {
      isDestMissing = true;
    }
  }

  if (isDestMissing && isSrcParentNewer) {
    copyFolderContent(srcParentPath + folderPath, destParentPath + folderPath);
  } else if (isDestMissing && isSrcParentOlder) {
    deleteTarget(srcParentPath + folderPath);
  } else if (isSrcNewer) {
    try {
      const dir = fs.readdirSync(srcParentPath + folderPath);
      dir.forEach(item => {
        processContent(srcParentPath + folderPath, destParentPath + folderPath, item);
      });
    } catch (error) {
      console.log("processFolder error", error);
    }
  }
};

const deleteTarget = async (targetPath) => {
  try {
    await rm(targetPath, { recursive: true, force: true });
    console.log("DELETED", "\"" + targetPath + "\"");
  } catch (error) {
    console.log("rm error", error);
    // TODO: should not happen
  }
};

const copyFileContent = async (srcPath, destPath) => {
  try {
    await copyFile(srcPath, destPath);
    console.log("COPIED", "\"" + srcPath + "\"", "to", "\"" + destPath + "\"");
  } catch (error) {
    console.log("copyContent error", error);
    // TODO: should not happen
  }
};

const copyFolderContent = async (srcPath, destPath) => {
  try {
    await cp(srcPath, destPath, { recursive: true, force: true });
    console.log("COPIED", "\"" + srcPath + "\"", "to", "\"" + destPath + "\"");
  } catch (error) {
    console.log("copyFolderContent error", error);
    // TODO: should not happen
  }
};

startWatcher(PATH_1, PATH_2);
startWatcher(PATH_2, PATH_1);
