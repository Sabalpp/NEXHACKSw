import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema with validation
const EnvSchema = z.object({
  // LLM API Keys
  OPENROUTER_KEY: z.string().min(1, 'OPENROUTER_KEY is required'),
  GEMINI_KEY: z.string().min(1, 'GEMINI_KEY is required'),
  
  // ElevenLabs
  ELEVENLABS_KEY: z.string().min(1, 'ELEVENLABS_KEY is required'),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'), // Rachel
  
  // Overshoot AI (optional)
  OVERSHOOT_KEY: z.string().optional(),
  
  // Server
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Parse and validate environment
function loadConfig() {
  const result = EnvSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  return result.data;
}

// Export validated config
export const config = loadConfig();

// Type export for use in other modules
export type Config = z.infer<typeof EnvSchema>;

// Log config status (without exposing secrets)
export function logConfigStatus() {
  console.log('✅ Configuration loaded successfully');
  console.log(`   - Environment: ${config.NODE_ENV}`);
  console.log(`   - Port: ${config.PORT}`);
  console.log(`   - OpenRouter: ${config.OPENROUTER_KEY.slice(0, 10)}...`);
  console.log(`   - Gemini: ${config.GEMINI_KEY.slice(0, 10)}...`);
  console.log(`   - ElevenLabs: ${config.ELEVENLABS_KEY.slice(0, 10)}...`);
  console.log(`   - Overshoot: ${config.OVERSHOOT_KEY ? 'configured' : 'not configured'}`);
}

