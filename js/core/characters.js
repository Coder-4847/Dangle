// Playable characters: original designs (colours + one simple head feature each). Data only, so the
// node tools can load it; js/render/characters.js turns it into sprites. Gloves are always
// left = blue, right = red, whoever you pick.
window.Dangle = window.Dangle || {};

Dangle.Characters = {
  list: [
    { id: 'pip',      name: 'Pip',      body: '#f2a03d', dark: '#b3621a', arm: '#d9832b', cheek: '#f26b4b', hat: 'sprout',    hatColor: '#6fbf5a' },
    { id: 'moss',     name: 'Moss',     body: '#6cc3a0', dark: '#2e8466', arm: '#4fa887', cheek: '#f28f8f', hat: 'beanie',    hatColor: '#e2574c' },
    { id: 'bluebell', name: 'Bluebell', body: '#76aee8', dark: '#3a6aa8', arm: '#5b93d1', cheek: '#f29ab6', hat: 'bow',       hatColor: '#f26b8a' },
    { id: 'sunny',    name: 'Sunny',    body: '#f5cf4a', dark: '#a8841c', arm: '#e0b634', cheek: '#f29a6b', hat: 'propeller', hatColor: '#4f86d9' },
    { id: 'rosie',    name: 'Rosie',    body: '#f295ad', dark: '#b8546f', arm: '#e07893', cheek: '#e8526f', hat: 'daisy',     hatColor: '#ffffff' },
    { id: 'plum',     name: 'Plum',     body: '#ae8ddb', dark: '#6a4fa3', arm: '#9373c7', cheek: '#f28fb0', hat: 'headband',  hatColor: '#f2c94c' },
  ],
  GLOVES: [
    { fill: '#4a8fe0', dark: '#23589e' },   // left
    { fill: '#e8544a', dark: '#a52a22' },   // right
  ],
  get(i) { const l = Dangle.Characters.list; return l[((i % l.length) + l.length) % l.length]; },
};
