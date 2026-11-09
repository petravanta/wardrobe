// Lets the app install and open offline: see https://github.com/petravanta/general/blob/main/STANDARDS.md#installing-on-a-phone
self.APP_SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon.svg',
  'data/types.json', 'data/colours.json', 'data/materials.json', 'data/seasons.json',
  'data/occasions.json', 'data/care.json', 'data/size-systems.json', 'data/gender-tags.json'];
importScripts('../general/shared/app-sw.js');
