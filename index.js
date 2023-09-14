const util = require('util');
const fs = require('fs');

const PATH_1 = process.argv[process.argv.length - 2];
const PATH_2 = process.argv[process.argv.length - 1];

const STAT_MODE_FOLDER = 16822;
const STAT_MODE_FILE = 33206;
const ERROR_CODE_ENOENT = "ENOENT";

console.log("sync-folders", PATH_1, PATH_2);

const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);
const copyFile = util.promisify(fs.copyFile);

const processContent = async (srcPath, destPath, name) => {
  try {
    const srcParentStat = await stat(srcPath);
    const destParentStat = await stat(destPath);
    try {
      const srcStat = await stat(srcPath + "/" + name);
      if (srcStat.mode === STAT_MODE_FOLDER) {
        processFolder(srcPath, destPath, name, srcParentStat, destParentStat, srcStat);
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
  fs.watch(srcPath, async (event, name) => {
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

  /* console.log({
    srcParentPath,
    destParentPath,
    filePath,
    isDestMissing,
    isSrcNewer,
    isSrcParentNewer,
    isSrcParentOlder
  }); */

  if ((isDestMissing && isSrcParentNewer) || isSrcNewer) {
    copyFileContent(srcParentPath + filePath, destParentPath + filePath);
  } else if (isDestMissing && isSrcParentOlder) {
    deleteTarget(srcParentPath + filePath);
  }
};

const processFolder = (srcParentPath, destParentPath, folderPath, srcParentStat, destParentStat, srcFolderStat) => {

};

startWatcher(PATH_1, PATH_2);
startWatcher(PATH_2, PATH_1);

const deleteTarget = async (targetPath) => {
  try {
    await unlink(targetPath);
    console.log("DELETED", "\"" + targetPath + "\"");
  } catch (error) {

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

/*
dev: 749821594,
  mode: 33206,
  nlink: 1,
  uid: 0,
  gid: 0,
  rdev: 0,
  blksize: 4096,
  ino: 15481123720459826,
  size: 0,
  blocks: 0,
  atimeMs: 1694714144963.8406,
  mtimeMs: 1694714144963.8406,
  ctimeMs: 1694714395482.428,
  birthtimeMs: 1694714144963.8406,
  atime: 2023-09-14T17:55:44.964Z,
  mtime: 2023-09-14T17:55:44.964Z,
  ctime: 2023-09-14T17:59:55.482Z,
  birthtime: 2023-09-14T17:55:44.964Z
*/
