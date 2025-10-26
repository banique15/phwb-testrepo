# Manual Data Export from Instant DB

Since the Instant DB SDK requires a browser environment for the reactive queries, the easiest way to export your data is through one of these methods:

## Option 1: Use Instant Dashboard (Recommended)

1. **Go to Instant Dashboard**: https://instantdb.com/dash
2. **Select your "hope" app** (ID: `14c443ea-7e34-4058-b167-7af45cae3f4f`)
3. **Navigate to Explorer tab**
4. **Use the query interface** to export data:

### Export Artists
```javascript
{
  artists: {
    employmentRecord: {},
    ensembles: {},
    leadingEnsembles: {},
    pianosProfile: {},
    publicHealthProfile: {},
    workforceDevelopmentProfile: {},
    programs: {},
    phwbPrograms: {}
  }
}
```

Copy the JSON response and save as `exports/artists-manual.json`

### Export Ensembles
```javascript
{
  ensembles: {
    leader: {},
    members: {}
  }
}
```

Copy the JSON response and save as `exports/ensembles-manual.json`

### Export All Profile Types
```javascript
{
  employmentRecords: { artist: {} },
  publicHealthProfiles: { artist: {} },
  pianosProfiles: { artist: {} },
  workforceDevelopmentProfiles: { artist: {} }
}
```

Copy and save as `exports/profiles-manual.json`

## Option 2: Create a Simple HTML Export Page

I can create a simple HTML file that you can open in your browser to export the data:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Instant DB Export</title>
    <script src="https://unpkg.com/@instantdb/core"></script>
</head>
<body>
    <h1>Instant DB Data Export</h1>
    <button onclick="exportData()">Export Data</button>
    <div id="status"></div>
    <script>
        const db = window.InstantReactWeb.init({
            appId: '14c443ea-7e34-4058-b167-7af45cae3f4f'
        });

        function exportData() {
            const status = document.getElementById('status');
            status.innerHTML = 'Exporting...';

            db.subscribeQuery({
                artists: {
                    employmentRecord: {},
                    ensembles: {},
                    leadingEnsembles: {},
                    pianosProfile: {},
                    publicHealthProfile: {},
                    workforceDevelopmentProfile: {},
                    programs: {},
                    phwbPrograms: {}
                },
                ensembles: {
                    leader: {},
                    members: {}
                }
            }, (resp) => {
                if (resp.data) {
                    const json = JSON.stringify(resp.data, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'instant-export.json';
                    a.click();
                    status.innerHTML = 'Export complete! Check your downloads.';
                }
            });
        }
    </script>
</body>
</html>
```

Save this as `export-page.html` and open it in your browser.

## Option 3: I Can Help You Export

If you have access to the Instant dashboard, you can:
1. Copy the data from the explorer
2. Paste it here
3. I'll save it to the correct format and proceed with transformation

## Next Steps

Once you have the exported JSON data:

1. **Save the complete export** as: `exports/instant-export-<timestamp>.json`
2. **Run the transformation script**:
   ```bash
   bun run scripts/transform-instant-data.ts exports/instant-export-<timestamp>.json
   ```
3. **Proceed with import** following the MIGRATION_README.md

---

**Note**: The programmatic export via SDK requires a browser environment because Instant DB uses WebSocket connections for real-time features. For one-time migration, manual export is the simplest approach.
