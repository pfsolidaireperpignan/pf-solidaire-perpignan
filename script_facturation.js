import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDmsIkTjW2IFkIks5BUAnxLLnc7pnj2e0w",
    authDomain: "pf-solidaire.firebaseapp.com",
    projectId: "pf-solidaire",
    storageBucket: "pf-solidaire.firebasestorage.app",
    messagingSenderId: "485465343242",
    appId: "1:485465343242:web:46d2a49f851a95907b26f3",
    measurementId: "G-TWLLXKF0K4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let clientsCache = [];
let currentClientId = null;
let currentInvoiceId = null; // ID de la FACTURE en cours (pour modification)

// --- SECURITE ---
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// --- INIT ---
window.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Charger Clients
    const datalist = document.getElementById('clients-datalist');
    if(datalist) {
        try {
            const q = query(collection(db, "dossiers_clients"), orderBy("lastModified", "desc"));
            const snaps = await getDocs(q);
            snaps.forEach((doc) => {
                const d = doc.data();
                const nom = `${d.nom || ''} ${d.prenom || ''}`;
                clientsCache.push({ id: doc.id, name: nom, address: d.demeurant || "", defunt: `${d.nom} ${d.prenom}` });
                const opt = document.createElement('option');
                opt.value = nom;
                datalist.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    // Charger Historique Factures
    window.chargerHistorique();

    // Lignes défaut
    window.ajouterTitreSection("1. PRESTATIONS");
    window.ajouterLigne("Cercueil", "NA", 0);
});

// --- HISTORIQUE & MODIFICATION ---
window.chargerHistorique = async function() {
    const tbody = document.getElementById('history-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    try {
        // Prendre les 20 derniers devis/factures
        const q = query(collection(db, "factures"), orderBy("created_at", "desc"), limit(20));
        const snaps = await getDocs(q);
        
        snaps.forEach(docSnap => {
            const d = docSnap.data();
            const dateF = new Date(d.created_at).toLocaleDateString();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateF}</td>
                <td><span class="status-tag">${d.type}</span> ${d.numero}</td>
                <td>${d.client_nom}</td>
                <td style="font-weight:bold;">${d.total}</td>
                <td>
                    <button onclick="window.chargerFacturePourModif('${docSnap.id}')" style="cursor:pointer; background:none; border:1px solid #ccc; padding:2px 8px; border-radius:4px;">
                        <i class="fas fa-pen"></i> Modifier
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="5">Aucun document.</td></tr>';
    } catch (e) { console.error(e); }
};

window.chargerFacturePourModif = async function(id) {
    try {
        const docRef = doc(db, "factures", id);
        const snap = await getDoc(docRef);
        if(!snap.exists()) return alert("Document introuvable");

        const d = snap.data();
        currentInvoiceId = id; // IMPORTANT : On est en mode édition
        currentClientId = d.client_id;

        // Remplir champs
        document.getElementById('doc_type').value = d.type;
        document.getElementById('facture_numero').value = d.numero;
        document.getElementById('facture_date').value = d.date;
        document.getElementById('facture_nom').value = d.client_nom;
        document.getElementById('facture_adresse').value = d.client_adresse || ""; // J'ai ajouté ce champ
        document.getElementById('facture_defunt').value = d.defunt_nom || "";
        document.getElementById('facture_sujet').value = d.sujet || "";

        // Remplir tableau
        const tbody = document.getElementById('lines-body');
        tbody.innerHTML = ''; // Vider
        d.lignes.forEach(l => {
            if(l.type === 'section') window.ajouterTitreSection(l.desc);
            else window.ajouterLigne(l.desc, l.tva, l.prix);
        });

        window.recalculer();
        window.scrollTo(0,0);
        alert(`Document ${d.numero} chargé pour modification.`);

    } catch (e) { console.error(e); alert("Erreur chargement"); }
};

// --- CLIENT ---
window.checkClientAuto = function() {
    const val = getVal('facture_nom');
    const found = clientsCache.find(c => c.name === val);
    if (found) {
        document.getElementById('facture_adresse').value = found.address;
        document.getElementById('facture_defunt').value = found.defunt;
        currentClientId = found.id;
        document.getElementById('facture_nom').style.backgroundColor = "#dcfce7";
    } else {
        currentClientId = null;
        document.getElementById('facture_nom').style.backgroundColor = "white";
    }
};

// --- TABLEAU ---
window.ajouterLigne = function(desc = "", tva = "NA", prix = 0) {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "line";
    tr.innerHTML = `
        <td style="padding-left:10px;"><input class="l-desc" value="${desc}" placeholder="..."></td>
        <td style="text-align:center;"><input class="l-tva" value="${tva}" style="text-align:center; width:50px;"></td>
        <td style="text-align:right;"><input type="number" class="l-prix" value="${prix}" step="0.01" style="text-align:right;" onchange="window.recalculer()"></td>
        <td></td>
        <td style="text-align:center;"><i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="this.closest('tr').remove(); window.recalculer();"></i></td>
    `;
    tbody.appendChild(tr);
    window.recalculer();
};

window.ajouterTitreSection = function(titre = "NOUVELLE SECTION") {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "section";
    tr.className = "section-row"; 
    tr.innerHTML = `
        <td colspan="4"><input class="l-desc" value="${titre}" style="font-weight:bold; padding-left:10px; width:100%;"></td>
        <td style="text-align:center;"><i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="this.closest('tr').remove(); window.recalculer();"></i></td>
    `;
    tbody.appendChild(tr);
};

window.recalculer = function() {
    let total = 0;
    document.querySelectorAll('tr[data-type="line"]').forEach(row => {
        const prix = parseFloat(row.querySelector('.l-prix').value) || 0;
        total += prix;
    });
    document.getElementById('total-ttc').textContent = total.toFixed(2) + ' €';
};

// --- SAUVEGARDE (ADD ou UPDATE) ---
window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = '...';
    
    const nom = getVal('facture_nom');
    if(!nom) { if(btn) btn.innerHTML = 'Enregistrer'; return alert("Nom obligatoire"); }

    try {
        // Prospect auto
        if (!currentClientId) {
            const newClient = {
                nom: nom,
                demeurant: getVal('facture_adresse'),
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        const data = {
            type: getVal('doc_type'),
            numero: getVal('facture_numero'),
            date: getVal('facture_date'),
            sujet: getVal('facture_sujet'),
            client_id: currentClientId,
            client_nom: nom,
            client_adresse: getVal('facture_adresse'), // Sauvegarde adresse
            defunt_nom: getVal('facture_defunt'),
            total: document.getElementById('total-ttc').textContent,
            lignes: [],
            created_at: new Date().toISOString()
        };

        document.querySelectorAll('#lines-body tr').forEach(row => {
            const type = row.dataset.type;
            const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
            const prix = (type === 'line') ? row.querySelector('.l-prix').value : "";
            const tva = (type === 'line') ? row.querySelector('.l-tva').value : "";
            data.lignes.push({ type, desc, prix, tva });
        });

        if(currentInvoiceId) {
            // MISE A JOUR
            await updateDoc(doc(db, "factures", currentInvoiceId), data);
            alert("Document modifié avec succès !");
        } else {
            // CREATION
            await addDoc(collection(db, "factures"), data);
            alert("Nouveau document créé !");
        }
        
        window.chargerHistorique(); // Rafraichir la liste en bas
        
    } catch (e) { console.error(e); alert("Erreur: " + e.message); }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

// --- PDF ---
window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const type = getVal('doc_type');
    const numero = getVal('facture_numero');

    const imgElement = document.getElementById('logo-source');
    if (imgElement && imgElement.naturalWidth > 0) pdf.addImage(imgElement, 'PNG', 15, 15, 35, 35);
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); 
    pdf.text("POMPES FUNEBRES", 15, 55);
    pdf.text("SOLIDAIRE PERPIGNAN", 15, 60);
    
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("32 boulevard Léon Jean Grégory Thuir - FRANCE", 15, 66);
    pdf.text("pfsolidaireperpignan@gmail.com", 15, 70);
    pdf.text("SIRET : 539 270 298 00042", 15, 74);
    pdf.text("Tél : +33 7 55 18 27 77", 15, 78);

    pdf.setFillColor(240, 240, 240); 
    pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille", 125, 28);
    pdf.setFont("helvetica", "normal");
    pdf.text(getVal('facture_nom'), 125, 35);
    const adresse = pdf.splitTextToSize(getVal('facture_adresse'), 70);
    pdf.text(adresse, 125, 42);

    let y = 90;
    const sujet = getVal('facture_sujet').toUpperCase();
    if(sujet) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    let dateFr = getVal('facture_date');
    if(dateFr.includes('-')) dateFr = dateFr.split('-').reverse().join('-');
    pdf.text(`${type} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    y += 10;

    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
        if (row.dataset.type === 'section') {
            rows.push([{ content: desc, colSpan: 4, styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'} }]);
        } else {
            const tva = row.querySelector('.l-tva') ? row.querySelector('.l-tva').value : "";
            const prixVal = row.querySelector('.l-prix') ? row.querySelector('.l-prix').value : 0;
            const prix = prixVal ? parseFloat(prixVal).toFixed(2) + ' €' : '';
            rows.push([desc, tva, prix, ""]); 
        }
    });

    pdf.autoTable({
        startY: 100,
        head: [['', 'TVA', 'PRIX TTC PRESTATIONS\nCOURANTES', 'PRIX TTC PRESTATIONS\nCOMPLEMENTAIRES\nOPTIONNELLES']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], lineColor: [200, 200, 200], lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 40, halign: 'right' }, 3: { cellWidth: 35 } }
    });

    let finalY = pdf.lastAutoTable.finalY + 10;
    pdf.setDrawColor(22, 101, 52); pdf.setLineWidth(0.5);
    pdf.rect(140, finalY, 50, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("Total (TTC)", 142, finalY + 8);
    pdf.text(document.getElementById('total-ttc').textContent, 188, finalY + 8, {align:'right'});

    finalY += 25;
    pdf.setFontSize(8); pdf.setTextColor(255, 0, 0); 
    pdf.text("NB :", 15, finalY);
    pdf.setTextColor(0);
    pdf.text("- (NA) TVA non applicable (0%), art 293 B du CGI", 25, finalY);
    pdf.text("- Conditions de paiement : 100% soit " + document.getElementById('total-ttc').textContent + " à payer à réception", 25, finalY + 5);

    pdf.save(`${type}_${numero}.pdf`);
};