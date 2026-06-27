const fs = require('fs');

const data = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Helper to strip HTML tags and clean up text
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<h4>(.*?)<\/h4>/gi, '. $1: ')
    .replace(/<li>(.*?)<\/li>/gi, '$1, ')
    .replace(/<ul>/gi, '')
    .replace(/<\/ul>/gi, '. ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/, \./g, '.')
    .replace(/\.+/g, '.')
    .trim();
}

function generateNarration(sceneId, title, infoText) {
  if (sceneId === 'scene1') {
    return "Welcome to the CV Raman Center, a Center of Excellence for Advanced Computational Skills and Research. During this virtual tour you will explore modern laboratories, advanced technologies, and innovation facilities designed to prepare students for future careers.";
  }
  
  if (title.toLowerCase().includes('way to') || title.toLowerCase().includes('way near') || title.toLowerCase().includes('fan area')) {
    return `You are currently navigating through the ${title.toLowerCase()}. Please use the navigation arrows to proceed.`;
  }
  
  if (!infoText) {
    if (title.toLowerCase().includes('cv raman center')) {
        return "You are in the CV Raman Center. Please continue exploring the campus.";
    }
    return `Welcome to the ${title}. Feel free to explore the area.`;
  }

  // Convert infoText list points into sentences
  let cleanInfo = stripHtml(infoText);
  // Ensure it starts well
  return `Welcome to the ${title}. ${cleanInfo}`;
}

const scenes = Object.keys(data.scenes);
scenes.forEach(sceneId => {
  const scene = data.scenes[sceneId];
  let infoText = '';
  
  if (scene.hotSpots) {
    const infoSpot = scene.hotSpots.find(h => h.type === 'info');
    if (infoSpot && infoSpot.clickHandlerArgs && infoSpot.clickHandlerArgs.description) {
      infoText = infoSpot.clickHandlerArgs.description;
    }
  }

  const narrationText = generateNarration(sceneId, scene.title, infoText);
  
  scene.audio = {
    autoplayOnSceneEnter: true,
    restartOnReEnter: true,
    stopOnSceneExit: true,
    delay: 700,
    loop: false,
    volume: 1.0,
    file: `audio/${sceneId}.mp3`,
    text: narrationText
  };
});
// git
fs.writeFileSync('config.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully updated config.json with audio objects.');
