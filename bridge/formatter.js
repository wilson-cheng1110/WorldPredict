export function formatSeed(event) {
  const entities = extractEntities(event);
  return [
    `EVENT: ${event.title}`,
    `DATE: ${event.published_at || new Date().toISOString()}`,
    `SOURCE: ${event.source || 'Unknown'}`,
    `REGION: ${event.region || 'Global'}`,
    `CATEGORY: ${event.category || 'general'}`,
    `CONTEXT: ${event.description || event.title}`,
    `KEY ENTITIES: ${entities.join(', ') || 'N/A'}`,
    `PREDICT: What are the downstream social, political, economic, and supply chain effects of this event over the next 6-18 months?`
  ].join('\n');
}

function extractEntities(event) {
  const text = `${event.title} ${event.description || ''}`;
  const patterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    /\b[A-Z]{2,}\b/g,
    /\b(?:United States|United Kingdom|European Union|North Korea|South Korea|Saudi Arabia)\b/gi,
  ];
  const found = new Set();
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) {
      if (m[0].length > 2) found.add(m[0]);
    }
  }
  return [...found].slice(0, 10);
}
