'use strict';
const store = DriveStore({
  clientId: GOOGLE_CLIENT_ID, file: 'Wardrobe data.json', app: 'wardrobe', key: 'wardrobe.drive',
  empty: blankDoc, merge: (remote, local) => mergeDocs(local, remote),
  onChange: () => showSaveState(),
  onRemote: data => remoteIn(data)
});
