import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VOTRE CONFIGURATION FIREBASE ---
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

// Fonction utilitaire pour éviter le crash "Null"
function safeVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : ""; // Si l'élément n'existe pas, on renvoie vide sans planter
}

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Chargement Clients
    const datalist = document.getElementById('clients-datalist');
    if(datalist) {
        try {
            const q = query(collection(db, "dossiers_clients"), orderBy("lastModified", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const nomComplet = `${data.nom || ''} ${data.prenom || ''}`;
                const adresse = data.demeurant || data.adresse_fr || "";
                clientsCache.push({ id: doc.id, name: nomComplet, address: adresse, defunt: `${data.nom} ${data.prenom}` });
                const option = document.createElement('option');
                option.value = nomComplet;
                datalist.appendChild(option);
            });
        } catch (e) { console.error("Erreur chargement clients", e); }
    }

    // Lignes par défaut
    window.ajouterTitreSection("1. PRESTATIONS");
    window.ajouterLigne("Cercueil", "NA", 0);
});

// --- FONCTIONS PUBLIQUES ---

window.checkClientAuto = function() {
    const val = safeVal('facture_nom');
    const found = clientsCache.find(c => c.name === val);
    
    if (found) {
        if(document.getElementById('facture_adresse')) document.getElementById('facture_adresse').value = found.address;
        if(document.getElementById('facture_defunt')) document.getElementById('facture_defunt').value = found.defunt;
        currentClientId = found.id;
        document.getElementById('facture_nom').style.backgroundColor = "#dcfce7";
    } else {
        currentClientId = null;
        document.getElementById('facture_nom').style.backgroundColor = "white";
    }
};

window.ajouterLigne = function(desc = "", tva = "NA", prix = 0) {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "line";
    tr.innerHTML = `
        <td style="padding-left:10px;"><input class="l-desc" value="${desc}" placeholder="Désignation"></td>
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
        const prixInput = row.querySelector('.l-prix');
        if(prixInput) {
            const prix = parseFloat(prixInput.value) || 0;
            total += prix;
        }
    });
    const totalEl = document.getElementById('total-ttc');
    if(totalEl) totalEl.textContent = total.toFixed(2) + ' €';
};

window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = 'Envoi...';
    
    const nom = safeVal('facture_nom');
    if(!nom) { 
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer'; 
        return alert("Nom du client obligatoire"); 
    }

    try {
        // Création Prospect
        if (!currentClientId) {
            const newClient = {
                nom: nom,
                demeurant: safeVal('facture_adresse'),
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT",
                notes: "Depuis Facturation"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        // Récupération sécurisée du type de doc (Select ou Radio)
        let docType = "DEVIS";
        const selectDoc = document.getElementById('doc_type');
        if(selectDoc) docType = selectDoc.value;
        else {
            const radio = document.querySelector('input[name="doc_type"]:checked');
            if(radio) docType = radio.value;
        }

        const factureData = {
            type: docType,
            numero: safeVal('facture_numero'),
            date: safeVal('facture_date'),
            sujet: safeVal('facture_sujet'),
            client_id: currentClientId,
            client_nom: nom,
            total: document.getElementById('total-ttc').textContent,
            lignes: [],
            created_at: new Date().toISOString()
        };

        document.querySelectorAll('#lines-body tr').forEach(row => {
            const type = row.dataset.type;
            const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
            const prix = (type === 'line' && row.querySelector('.l-prix')) ? row.querySelector('.l-prix').value : "";
            const tva = (type === 'line' && row.querySelector('.l-tva')) ? row.querySelector('.l-tva').value : "";
            factureData.lignes.push({ type, desc, prix, tva });
        });

        await addDoc(collection(db, "factures"), factureData);
        alert("Enregistré avec succès !");
        
    } catch (e) { 
        console.error(e);
        alert("Erreur technique : " + e.message); 
    }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Récupération sécurisée des valeurs
    let docType = "DEVIS";
    const selectDoc = document.getElementById('doc_type');
    if(selectDoc) docType = selectDoc.value;
    else {
        const radio = document.querySelector('input[name="doc_type"]:checked');
        if(radio) docType = radio.value;
    }
    
    const numero = safeVal('facture_numero');

    // --- LOGO & ENTETE ---
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

    // --- FAMILLE ---
    pdf.setFillColor(240, 240, 240); 
    pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille", 125, 28);
    pdf.setFont("helvetica", "normal");
    pdf.text(safeVal('facture_nom'), 125, 35);
    const adresse = pdf.splitTextToSize(safeVal('facture_adresse'), 70);
    pdf.text(adresse, 125, 42);

    // --- TITRE ---
    let y = 90;
    const sujet = safeVal('facture_sujet').toUpperCase();
    if(sujet) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    // Gestion date sécurisée
    let dateFr = safeVal('facture_date');
    if(dateFr.includes('-')) dateFr = dateFr.split('-').reverse().join('-');
    
    pdf.text(`${docType} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    y += 10;

    // --- TABLEAU ---
    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
        if (row.dataset.type === 'section') {
            rows.push([{
                content: desc, 
                colSpan: 4, 
                styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'}
            }]);
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
        columnStyles: { 
            0: { cellWidth: 100 }, 
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 35 }
        },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 }
    });

    // --- TOTAL ---
    let finalY = pdf.lastAutoTable.finalY + 10;
    pdf.setDrawColor(22, 101, 52); pdf.setLineWidth(0.5);
    pdf.rect(140, finalY, 50, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("Total (TTC)", 142, finalY + 8);
    pdf.text(document.getElementById('total-ttc').textContent, 188, finalY + 8, {align:'right'});

    // --- PIED DE PAGE ---
    finalY += 25;
    pdf.setFontSize(8); pdf.setTextColor(255, 0, 0); 
    pdf.text("NB :", 15, finalY);
    pdf.setTextColor(0);
    pdf.text("- (NA) TVA non applicable (0%), art 293 B du CGI", 25, finalY);
    pdf.text("- Conditions de paiement : 100% soit " + document.getElementById('total-ttc').textContent + " à payer à réception", 25, finalY + 5);

    pdf.save(`${docType}_${numero}.pdf`);
};
