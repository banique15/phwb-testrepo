#!/usr/bin/env node

/**
 * Timesheet to Events Conversion Script
 * 
 * This script converts timesheet CSV data to Supabase events table format.
 * It groups individual artist entries by date and venue to create events.
 * 
 * Usage: node timesheet_to_events.js [--test] [--last-n=10]
 */

const fs = require('fs');
const path = require('path');

// Venue name mapping from CSV to existing Supabase venues
const VENUE_MAPPING = {
  'Moynihan Train Hall': 14,
  'Union Station, D.C. (DC)': 12,
  'Lenox Hill Neighborhood House': 15,
  'NYC Health + Hospitals/Jacobi': null, // Will need to add
  'Rodney Kirk Senior Center at Manhattan Plaza': null, // Will need to add
  'Maimonides Medical Center - Brooklyn': null, // Will need to add
  'Henry Street Settlement': 21,
  'Riverstone Senior Center': 19,
  'NYC Health + Hospitals/Coler': null, // Will need to add
  'Sing for Hope Lab at Amani': null, // Will need to add
  'NYC Health + Hospitals/North Central Bronx': 17,
  'NYC Health + Hospitals/Queens': null, // Will need to add
  'NYC Health + Hospitals/Kings County': null, // Will need to add
  // Add more mappings as needed
};

// Event types that should be filtered out (not real performance events)
const EXCLUDE_EVENTS = [
  'Harassment Prevention Training',
  'Sick Time'
];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && nextChar === ',') {
      inQuotes = false;
    } else if (char === '"' && inQuotes && (nextChar === undefined || nextChar === '\n')) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.split(',').every(cell => !cell.trim())) continue;
    
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Only include rows with valid dates and non-excluded events
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    const cleanLocation = row.Location.replace(/"/g, '');
    
    if (row.Date && 
        datePattern.test(row.Date) && 
        row.Location && 
        !EXCLUDE_EVENTS.includes(cleanLocation) &&
        row.Date !== 'Date' && 
        row.Date !== 'Helper Row') {
      data.push(row);
    }
  }
  
  return data;
}

function groupByEvent(timesheetData) {
  const events = {};
  
  timesheetData.forEach(row => {
    const date = row.Date;
    const location = row.Location.replace(/"/g, ''); // Remove quotes
    const eventKey = `${date}|${location}`;
    
    if (!events[eventKey]) {
      events[eventKey] = {
        date: date,
        location: location,
        artists: [],
        totalHours: 0,
        notes: []
      };
    }
    
    // Extract artist name (remove quotes)
    const artistName = row.Name.replace(/"/g, '');
    const hours = parseFloat(row.Hours) || 0;
    const rate = row.Rate || '';
    const total = row.Total || '';
    const notes = row.Notes || '';
    
    events[eventKey].artists.push({
      name: artistName,
      hours: hours,
      rate: rate,
      total: total,
      notes: notes,
      rawData: {
        Hours: row.Hours,
        Rate: row.Rate,
        Total: row.Total,
        'Additional Pay': row['Additional Pay'] || '',
        'Reason for Add\'l Pay': row['Reason for Add\'l Pay'] || ''
      }
    });
    
    events[eventKey].totalHours += hours;
    
    if (notes) {
      events[eventKey].notes.push(`${artistName}: ${notes}`);
    }
  });
  
  return Object.values(events);
}

function convertToSupabaseFormat(events) {
  return events.map(event => {
    // Parse date (format: MM/DD/YYYY)
    const [month, day, year] = event.date.split('/');
    const eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const formattedDate = eventDate.toISOString().split('T')[0];
    
    // Determine venue ID
    const venueId = VENUE_MAPPING[event.location] || null;
    
    // Generate title
    const title = `Performance at ${event.location}`;
    
    // Estimate start/end times based on total hours
    const avgHours = event.totalHours / event.artists.length;
    let startTime = '10:00:00'; // Default start time
    let endTime = '12:00:00';   // Default end time
    
    if (avgHours >= 3) {
      startTime = '10:00:00';
      endTime = '13:00:00';
    } else if (avgHours >= 2) {
      startTime = '11:00:00';
      endTime = '13:00:00';
    } else {
      startTime = '12:00:00';
      endTime = '13:00:00';
    }
    
    // Build artists array with structured data
    const artistsData = event.artists.map(artist => ({
      name: artist.name,
      hours: artist.hours,
      rate: artist.rate,
      total: artist.total,
      role: artist.hours > 2 ? 'performer' : 'support',
      notes: artist.notes
    }));
    
    return {
      title: title,
      date: formattedDate,
      start_time: startTime,
      end_time: endTime,
      venue: venueId,
      status: 'scheduled', // Since these are future events
      artists: artistsData,
      notes: {
        location: event.location,
        total_hours: event.totalHours,
        artist_count: event.artists.length,
        imported_from: 'timesheet_csv',
        import_date: new Date().toISOString(),
        notes: event.notes
      },
      schedule: {
        performance_duration: `${Math.round(avgHours * 60)} minutes`,
        setup_time: '30 minutes',
        breakdown_time: '30 minutes'
      },
      requirements: {
        artist_count: event.artists.length,
        equipment: 'TBD',
        space: 'Performance area'
      }
    };
  });
}

function generateSQL(events, testMode = false) {
  const sqlStatements = [];
  
  // Add missing venues first
  const missingVenues = new Set();
  events.forEach(event => {
    if (!event.venue && event.notes.location) {
      missingVenues.add(event.notes.location);
    }
  });
  
  if (missingVenues.size > 0) {
    sqlStatements.push('-- Missing venues that need to be added:');
    missingVenues.forEach(venue => {
      const escapedVenue = venue.replace(/'/g, "''");
      sqlStatements.push(`INSERT INTO phwb_venues (name, type, description) VALUES ('${escapedVenue}', 'Performance Venue', 'Imported from timesheet data') ON CONFLICT (name) DO NOTHING;`);
    });
    sqlStatements.push('');
  }
  
  sqlStatements.push('-- Event inserts:');
  
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const escapedTitle = event.title.replace(/'/g, "''");
    const escapedArtists = JSON.stringify(event.artists).replace(/'/g, "''");
    const escapedNotes = JSON.stringify(event.notes).replace(/'/g, "''");
    const escapedSchedule = JSON.stringify(event.schedule).replace(/'/g, "''");
    const escapedRequirements = JSON.stringify(event.requirements).replace(/'/g, "''");
    
    const sql = `INSERT INTO phwb_events (
  title, 
  date, 
  start_time, 
  end_time, 
  venue, 
  status, 
  artists, 
  notes, 
  schedule, 
  requirements
) VALUES (
  '${escapedTitle}',
  '${event.date}',
  '${event.start_time}',
  '${event.end_time}',
  ${event.venue || 'NULL'},
  '${event.status}',
  '${escapedArtists}',
  '${escapedNotes}',
  '${escapedSchedule}',
  '${escapedRequirements}'
);`;
    
    sqlStatements.push(sql);
    
    if (testMode && index >= 0) { // For testing, only process first event
      break;
    }
  }
  
  return sqlStatements.join('\n\n');
}

function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const lastNArg = args.find(arg => arg.startsWith('--last-n='));
  const lastN = lastNArg ? parseInt(lastNArg.split('=')[1]) : null;
  
  try {
    // Read CSV file
    const csvPath = path.join(__dirname, 'timesheet.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📊 Parsing CSV data...');
    const timesheetData = parseCSV(csvContent);
    console.log(`Found ${timesheetData.length} timesheet entries`);
    
    // Filter to last N entries if specified
    let filteredData = timesheetData;
    if (lastN) {
      // Filter for only 2025 events (future scheduled events)
      const scheduled2025Events = timesheetData.filter(row => {
        const [month, day, year] = row.Date.split('/');
        return parseInt(year) === 2025;
      });
      
      // Sort by date first to ensure we get the actual last events
      const sortedData = scheduled2025Events.sort((a, b) => {
        const [monthA, dayA, yearA] = a.Date.split('/');
        const [monthB, dayB, yearB] = b.Date.split('/');
        const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
        const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
        return dateA - dateB;
      });
      filteredData = sortedData.slice(-lastN);
      console.log(`Filtered to last ${lastN} entries by date (2025 events only)`);
      console.log('Debug: Last few dates:', filteredData.map(d => d.Date).slice(-3));
    }
    
    console.log('🎪 Grouping data by events...');
    const events = groupByEvent(filteredData);
    console.log(`Created ${events.length} unique events`);
    
    console.log('🔄 Converting to Supabase format...');
    const supabaseEvents = convertToSupabaseFormat(events);
    
    // Sort by date (most recent first for testing)
    supabaseEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // If testing or last-n, limit results
    let finalEvents = supabaseEvents;
    if (testMode || lastN) {
      finalEvents = supabaseEvents.slice(0, lastN || 1);
      console.log(`Limited to ${finalEvents.length} events for ${testMode ? 'testing' : 'last-n'}`)
    }
    
    console.log('📝 Generating SQL...');
    const sql = generateSQL(finalEvents, testMode);
    
    // Write SQL to file
    const outputPath = path.join(__dirname, testMode ? 'test_events.sql' : 'import_events.sql');
    fs.writeFileSync(outputPath, sql);
    
    console.log(`✅ Generated SQL file: ${outputPath}`);
    console.log(`📊 Summary:`);
    console.log(`  - ${finalEvents.length} events to be imported`);
    console.log(`  - Date range: ${finalEvents[finalEvents.length-1]?.date} to ${finalEvents[0]?.date}`);
    
    // Show first event as example
    if (finalEvents.length > 0) {
      console.log(`\n📋 Sample event:`);
      console.log(`  Title: ${finalEvents[0].title}`);
      console.log(`  Date: ${finalEvents[0].date}`);
      console.log(`  Artists: ${finalEvents[0].artists.length}`);
      console.log(`  Venue ID: ${finalEvents[0].venue || 'NULL (needs venue creation)'}`);
    }
    
    if (testMode) {
      console.log('\n🧪 Test mode completed. Review test_events.sql before running full import.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseCSV, groupByEvent, convertToSupabaseFormat, generateSQL };