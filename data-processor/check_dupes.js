const XLSX = require('xlsx'); 
const data = XLSX.utils.sheet_to_json(XLSX.readFile('../IIST Internal Hackathon 2026 (Responses) (1).xlsx').Sheets[XLSX.readFile('../IIST Internal Hackathon 2026 (Responses) (1).xlsx').SheetNames[0]]);
const seenTeams = new Set();
const duplicates = [];

for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    let teamName = row['TEAM NAME'] ? String(row['TEAM NAME']).trim().toLowerCase().replace(/\s+/g, ' ') : '';
    let leaderEmail = row["TEAM LEADER'S mail id"] ? String(row["TEAM LEADER'S mail id"]).trim().toLowerCase() : '';
    let key = teamName || leaderEmail || JSON.stringify(row);
    if (seenTeams.has(key)) {
        duplicates.push(row['TEAM NAME'] || row["TEAM LEADER'S mail id"]);
    } else {
        seenTeams.add(key);
    }
}
console.log('Duplicates found:');
duplicates.forEach(d => console.log('- ' + d));
