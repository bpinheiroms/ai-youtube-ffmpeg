import { OpenAiContext } from "./contexts/openai";

import * as dotenv from 'dotenv';
dotenv.config();

const main = async () => {
  try {
    const context = OpenAiContext();
    context.init();
    
  } catch (err) {
    console.error("Ocorreu um erro:", err);
  }
};

main();
