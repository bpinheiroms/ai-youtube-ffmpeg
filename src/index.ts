import { MainContext } from "./contexts/main";

import * as dotenv from 'dotenv';
dotenv.config();

const main = async () => {
  try {
    const context = MainContext();
    await context.init();
    
  } catch (err) {
    console.error("Ocorreu um erro:", err);
  }
};

main();
