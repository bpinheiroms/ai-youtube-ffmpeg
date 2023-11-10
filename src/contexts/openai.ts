import { splitAudioAndTranscribe } from "../libs/audio";
import { joinTextFiles, saveTextToFile } from "../libs/file";
import {
  createDirectoryIfNotExists,
  deleteFolderIfExists,
} from "../libs/folder";
import { createSummary } from "../libs/openai";
import { createPDFFromTXT } from "../libs/pdf";
import { downloadVimeo } from "../libs/vimeo";
import { downloadYouTubeVideoAsMP3 } from "../libs/youtube";
import { vimeoPath, youtubePath } from "../utils/const";

import { calculateTime } from "../utils/misc";

export const OpenAiContext = () => {
  let startDate = new Date();

  function startTime() {
    startDate = new Date();
  }

  function closeTime() {
    const end = new Date();
    console.log(`Time spent: ${calculateTime(startDate, end)}`);
  }

  function prepareStructure() {
    if (process.env.CONFIG_DELETE === "true") deleteFolderIfExists("source");

    createDirectoryIfNotExists(youtubePath.textSegment);
    createDirectoryIfNotExists(youtubePath.summarySegment);
    createDirectoryIfNotExists(youtubePath.segments);

    createDirectoryIfNotExists(vimeoPath.textSegment);
    createDirectoryIfNotExists(vimeoPath.summarySegment);
    createDirectoryIfNotExists(vimeoPath.segments);
  }

  async function transcribeVideo() {
    const ref = process.env.CONFIG_SOURCE === "vimeo" ? vimeoPath : youtubePath;

    if (process.env.CONFIG_SOURCE === "youtube")
      await downloadYouTubeVideoAsMP3(ref.mp3);

    if (process.env.CONFIG_SOURCE === "vimeo") await downloadVimeo();

    await splitAudioAndTranscribe(ref.mp3, ref.segments, ref.textSegment);
  }

  async function getSummary() {
    const ref = process.env.CONFIG_SOURCE === "vimeo" ? vimeoPath : youtubePath;

    await createSummary(ref.textSegment, ref.summarySegment, ref.text);
    const txtContent = await joinTextFiles(ref.summarySegment);
    saveTextToFile(txtContent, ref.summary);
  }

  async function createPDF() {
    const ref = process.env.CONFIG_SOURCE === "vimeo" ? vimeoPath : youtubePath;

    await createPDFFromTXT(ref.summary, ref.pdf);
  }

  async function init() {
    startTime();

    prepareStructure();

    if (process.env.CONFIG_TRANSCRIBE === "true") await transcribeVideo();
    if (process.env.CONFIG_GET_SUMMARY === "true") await getSummary();
    if (process.env.CONFIG_CREATE_PDF === "true") await createPDF();
    closeTime();
  }

  return { init };
};
