import * as fs from "fs";
import path from "path";

export const removeFile = (filePath: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log("File removed:", filePath);
        resolve();
      }
    });
  });
};

export const readTextFile = (filePath: string): string => {
  return fs.readFileSync(filePath, "utf8");
};

export const readFile = (filePath: string): Buffer => {
  return fs.readFileSync(filePath);
};

export const saveTextToFile = (text: string, filePath: string): void => {
  fs.writeFileSync(filePath, text, "utf8");
  console.log(`Text saved in ${filePath}`);
};

export const getBuffersFromFiles = async (
  fileNames: string[],
  folderPath: string
) => {
  try {
    const buffers: Buffer[] = [];

    for (const fileName of fileNames) {
      const filePath = path.join(folderPath, fileName);
      const fileData = await readFile(filePath);
      const fileBuffer = Buffer.from(fileData);
      buffers.push(fileBuffer);
    }

    return buffers;
  } catch (error) {
    console.error(
      "[getBuffersFromFiles] - An error occurred while convert files:",
      error
    );
    throw error;
  }
};

export const joinTextFiles = async (folderPath: string): Promise<string> => {
  try {
    const fileNames = await fs.promises.readdir(folderPath);

    const compareFileNames = (a: string, b: string): number => {
      const fileNumberA = parseInt(a.split("_")[1].split(".")[0]);
      const fileNumberB = parseInt(b.split("_")[1].split(".")[0]);
      return fileNumberA - fileNumberB;
    };

    fileNames.sort(compareFileNames);

    let result = "";

    for (const fileName of fileNames) {
      const filePath = path.join(folderPath, fileName);
      const fileData = await fs.promises.readFile(filePath, "utf-8");
      result += fileData + "\n";
    }

    return result;
  } catch (error) {
    console.error("An error occurred while reading files:", error);
    throw error;
  }
};
