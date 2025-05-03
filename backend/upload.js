import express from 'express';
import multer from 'multer';
import { supabase } from './db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Function to run Python script
async function runPythonConversion(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('Running Python conversion script');
    console.log(`Input path: ${inputPath}`);
    console.log(`Output path: ${outputPath}`);
    
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'main.py'),
      '--input', inputPath,
      '--output', outputPath
    ]);

    pythonProcess.stdout.on('data', (data) => {
      console.log('Python script output:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python script error:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        reject(new Error(`Python script failed with code ${code}`));
      } else {
        console.log('Python conversion completed successfully');
        resolve();
      }
    });
  });
}

router.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Received file upload request');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const file = req.file;
  
    if (!file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No file uploaded' });
    }
  
    console.log('File received:', file.originalname);
    console.log('File size:', file.size);
    console.log('File mimetype:', file.mimetype);
  
    // Create proper path structure
    const timestamp = Date.now();
    const storagePath = `uploads/${timestamp}_${file.originalname}`;
    console.log('Storage path:', storagePath);
    
    // Create absolute paths for local processing
    const tempDir = path.join(__dirname, 'temp');
    const outputDir = path.join(__dirname, '..', 'outputs');
    const tempFilePath = path.join(tempDir, file.originalname);
    const outputPath = path.join(outputDir, `${timestamp}_output.tex`);
    
    console.log('Temp directory:', tempDir);
    console.log('Output directory:', outputDir);
    console.log('Temp file path:', tempFilePath);
    console.log('Output path:', outputPath);
    
    // Ensure directories exist
    if (!fs.existsSync(tempDir)) {
      console.log('Creating temp directory');
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      console.log('Creating output directory');
      fs.mkdirSync(outputDir, { recursive: true });
    }
  
    try {
      // Save file temporarily
      console.log('Saving file temporarily to:', tempFilePath);
      fs.writeFileSync(tempFilePath, file.buffer);
      
      // Upload to Supabase Storage
      console.log('Uploading to Supabase storage');
      const { data, error } = await supabase.storage
        .from('docs')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
  
      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(error.message);
      }
      console.log('Supabase storage upload successful:', data);
      
      // Create record in docs table
      console.log('Creating database record');
      const { data: docRecord, error: docError } = await supabase
        .from('docs')
        .insert([{
          user_id: req.body.user_id || '00000000-0000-0000-0000-000000000000', // Default UUID
          original_filename: file.originalname,
          pdf_storage_path: storagePath
        }])
        .select();
  
      if (docError) {
        console.error('Database insert error:', docError);
        throw new Error(docError.message);
      }
      console.log('Database record created:', docRecord);
  
      // Run Python conversion script
      try {
        await runPythonConversion(tempFilePath, outputPath);
        console.log('Conversion completed successfully');
        
        // Get relative path for storage
        const latexStoragePath = `outputs/${path.basename(outputPath)}`;
        console.log('LaTeX storage path:', latexStoragePath);
        
        // Update database with LaTeX path
        console.log('Updating database record with LaTeX path');
        const { error: updateError } = await supabase
          .from('docs')
          .update({ latex_storage_path: latexStoragePath })
          .eq('id', docRecord[0].id);

        if (updateError) {
          console.error('Database update error:', updateError);
        }
        
        // Clean up temp file
        console.log('Cleaning up temporary file');
        fs.unlinkSync(tempFilePath);
        
        res.json({ 
          success: true, 
          path: storagePath,
          output: latexStoragePath,
          documentId: docRecord[0].id
        });
      } catch (conversionError) {
        console.error('Conversion error:', conversionError);
        throw conversionError;
      }
  
    } catch (error) {
      console.error('Error in upload process:', error);
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      res.status(500).json({ error: error.message });
    }
});

export default router;