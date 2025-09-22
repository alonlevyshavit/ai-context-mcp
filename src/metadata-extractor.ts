export interface ExtractedMetadata {
  content: string;  // Raw metadata content to include in tool description
  source: 'yaml' | 'html' | 'paragraph';
}

export function extractMetadata(content: string): ExtractedMetadata {
  // Method 1: Try YAML frontmatter
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    return {
      content: yamlMatch[1].trim(),
      source: 'yaml'
    };
  }

  // Method 2: Try HTML metadata comment
  const htmlMatch = content.match(/<!--\s*metadata\s*\n([\s\S]*?)\s*-->/);
  if (htmlMatch) {
    return {
      content: htmlMatch[1].trim(),
      source: 'html'
    };
  }

  // Method 3: Fallback to first paragraph
  // Remove the header if present
  const withoutHeader = content.replace(/^#[^\n]*\n+/, '');

  // Find first paragraph or content before "Read:" directives
  const beforeReads = withoutHeader.split(/\nRead:/)[0];

  // Take first paragraph (up to double newline)
  const paragraphEnd = beforeReads.indexOf('\n\n');
  let firstParagraph = '';

  if (paragraphEnd !== -1) {
    firstParagraph = beforeReads.substring(0, paragraphEnd);
  } else {
    // No double newline found, take up to first 500 chars or until a natural break
    firstParagraph = beforeReads.substring(0, 500);
    const lastPeriod = firstParagraph.lastIndexOf('.');
    const lastNewline = firstParagraph.lastIndexOf('\n');
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > 200) {
      firstParagraph = firstParagraph.substring(0, cutPoint + 1);
    }
  }

  // Clean up whitespace
  firstParagraph = firstParagraph.trim();

  return {
    content: firstParagraph || 'No description available',
    source: 'paragraph'
  };
}