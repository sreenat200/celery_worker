import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from '../src/worker-app.module';
import { AzureQwenService } from '../src/ai/azure-qwen.service';
import { generateSectionPrompt } from '../src/ai/ai.prompt';

async function main() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const qwenService = app.get(AzureQwenService);
  
  const userPrompt = "Create a simple section with an image on the left, heading and description on the right, and a Shop Now button. Make it responsive for mobile.";
  const fullPrompt = generateSectionPrompt(userPrompt);
  
  console.log("Calling Qwen...");
  try {
    const rawResponse = await qwenService.generateText(fullPrompt, 2000);
    console.log("=========================================");
    console.log("RAW RESPONSE:");
    console.log(rawResponse);
    console.log("=========================================");
    
    const jsonStart = rawResponse.indexOf('{');
    const jsonEnd = rawResponse.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const extracted = rawResponse.substring(jsonStart, jsonEnd + 1);
      console.log("Parsed using substring:");
      console.log(JSON.parse(extracted));
    } else {
      console.log("Parsed raw:");
      console.log(JSON.parse(rawResponse));
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await app.close();
  }
}
main();
