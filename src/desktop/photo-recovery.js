/** Fill missing photos by the preserved source ID; never replace user images or edits. */
export function upgradeWorkingPhotos(raw, dataset) {
  const version = Number(dataset?.migration?.photoRecoveryVersion || 0);
  const sourceHash = dataset?.migration?.sourceHash;
  if (raw == null || !Number.isFinite(version) || version <= 0
    || typeof sourceHash !== 'string' || !sourceHash || !Array.isArray(dataset?.nom)) return raw;
  try {
    const saved = JSON.parse(raw);
    if (saved?.migration?.sourceHash !== sourceHash
      || Number(saved.migration?.photoRecoveryVersion || 0) >= version || !Array.isArray(saved.nom)) return raw;
    const photos = new Map(dataset.nom.filter(item=>item?.id && item.imageUrl && !item.photoRemoved).map(item=>[item.id,item]));
    return JSON.stringify({...saved,migration:{...saved.migration,photoRecoveryVersion:version},nom:saved.nom.map(item=>{
      const photo=photos.get(item?.nid || item?.id);
      if (!photo || item.photoRemoved || item.imageUrl || item.img || item.photo) return item;
      return {...item,img:photo.img,imageUrl:photo.imageUrl};
    })});
  } catch {return raw;}
}
