export function getNameFromFQN(FQN) {
  const seg = FQN.split('.');
  return seg[seg.length - 1];
}

export function getPackageFromFQN(FQN) {
  const seg = FQN.split('.');
  return seg.slice(0, seg.length - 1).join('.');
}
