export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Simple PDF text extraction using basic parsing
  // Convert to string and extract text between stream markers
  let text = '';
  const decoder = new TextDecoder('latin1');
  const rawText = decoder.decode(uint8Array);
  
  // Extract text from PDF streams
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  while ((match = streamRegex.exec(rawText)) !== null) {
    const streamContent = match[1];
    // Extract readable text patterns
    const textMatches = streamContent.match(/\(([^)]*)\)/g);
    if (textMatches) {
      for (const tm of textMatches) {
        const cleaned = tm.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (cleaned.trim() && /[a-zA-ZäöüÄÖÜß0-9]/.test(cleaned)) {
          text += cleaned + ' ';
        }
      }
    }
    
    // Also try BT/ET text blocks with Tj/TJ operators
    const tjMatches = streamContent.match(/\[(.*?)\]\s*TJ/g);
    if (tjMatches) {
      for (const tj of tjMatches) {
        const parts = tj.match(/\(([^)]*)\)/g);
        if (parts) {
          for (const p of parts) {
            const cleaned = p.slice(1, -1);
            if (cleaned.trim()) text += cleaned;
          }
          text += ' ';
        }
      }
    }
  }
  
  // If basic extraction fails, try using the PDF.js-like approach
  if (text.trim().length < 50) {
    // Fallback: extract any readable text sequences
    const readableRegex = /[A-Za-zäöüÄÖÜß0-9€.,;:!?\-\s/()%]{4,}/g;
    const readableMatches = rawText.match(readableRegex);
    if (readableMatches) {
      text = readableMatches.join(' ');
    }
  }
  
  return text.replace(/\s+/g, ' ').trim();
}
