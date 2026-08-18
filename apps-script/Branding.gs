/**
 * One-time display-brand migration.
 *
 * Safe for the existing production database because it does NOT:
 * - recreate sheets
 * - reset counters
 * - change IDs / DE- prefixes
 * - change the web-app URL
 * - change users or passwords
 */
function applyThambiliBranding() {
  const companyName = 'Thambili Events';
  const now = nowIso_();

  // Update only COMPANY_NAME in 00_SETTINGS.
  const existing = getRows_('00_SETTINGS').find(r => String(r.Key || '') === 'COMPANY_NAME');
  if (existing) {
    updateObjectRow_('00_SETTINGS', existing._row, {
      Value: companyName,
      Description: 'Company display name',
      Updated_At: now,
      Updated_By: 'BRAND_MIGRATION'
    });
  } else {
    appendObject_('00_SETTINGS', {
      Key: 'COMPANY_NAME',
      Value: companyName,
      Description: 'Company display name',
      Updated_At: now,
      Updated_By: 'BRAND_MIGRATION'
    });
  }

  // Rename the existing Drive/database containers by ID.
  // IDs remain unchanged, so all existing links and Script Properties continue to work.
  const props = PropertiesService.getScriptProperties();
  const dbId = props.getProperty(DE.DB_PROP);
  const driveFolderId = props.getProperty(DE.DRIVE_PROP);

  let databaseRenamed = false;
  let driveFolderRenamed = false;

  if (dbId) {
    try {
      DriveApp.getFileById(dbId).setName('Thambili Events Finance DB');
      databaseRenamed = true;
    } catch (_) {}
  }

  if (driveFolderId) {
    try {
      DriveApp.getFolderById(driveFolderId).setName('Thambili Events Finance');
      driveFolderRenamed = true;
    } catch (_) {}
  }

  return {
    companyName: companyName,
    databaseRenamed: databaseRenamed,
    driveFolderRenamed: driveFolderRenamed,
    note: 'Existing DE- record numbers and technical DREAM_EVENTS_* keys were intentionally retained.'
  };
}
