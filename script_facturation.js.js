/* ==========================================================================
   MODULE FACTURATION - "FAST TRACK"
   ========================================================================== */
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

// Stockage temporaire des clients pour la recherche rapide
let clientsCache = []; 
let currentClientId = null;

/* ==========================================================================
   INIT & RECHERCHE RAPIDE
   ========================================================================== */

window.addEventListener('DOMContentLoaded', async () => {
    // Date du jour
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

    // Lignes par défaut (Exemple)
    window.ajouterTitreSection("1. PRESTATIONS COURANTES");
    window.ajouterLigne("Cercueil", "NA", 0);
});

// --- FONCTIONS PUBLIQUES (WINDOW) ---

// 1. Recherche Auto
window.checkClientAuto = function() {
    const val = document.getElementById('facture_nom').value;
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

// 2. Ajouter une Ligne simple
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

// 3. Ajouter un Titre de Section (Orange)
window.ajouterTitreSection = function(titre = "NOUVELLE SECTION") {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "section";
    tr.className = "section-row"; 
    tr.innerHTML = `
        <td colspan="4"><input class="l-desc" value="${titre}" style="font-weight:bold; color:#9a3412; padding-left:10px; width:100%;"></td>
        <td style="text-align:center;"><i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="this.closest('tr').remove(); window.recalculer();"></i></td>
    `;
    tbody.appendChild(tr);
};

// 4. Calculs
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

// 5. Sauvegarder
window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = 'Envoi...';
    
    const nom = document.getElementById('facture_nom').value;
    if(!nom) { 
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer'; 
        return alert("Nom du client obligatoire"); 
    }

    try {
        // Création Prospect si inconnu
        if (!currentClientId) {
            const newClient = {
                nom: nom,
                demeurant: document.getElementById('facture_adresse').value,
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT",
                notes: "Depuis Facturation"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        // Données Facture
        const factureData = {
            type: document.getElementById('doc_type').value,
            numero: document.getElementById('facture_numero').value,
            date: document.getElementById('facture_date').value,
            sujet: document.getElementById('facture_sujet').value,
            client_id: currentClientId,
            client_nom: nom,
            total: document.getElementById('total-ttc').textContent,
            lignes: [],
            created_at: new Date().toISOString()
        };

        // Capture des lignes
        document.querySelectorAll('#lines-body tr').forEach(row => {
            const type = row.dataset.type;
            const desc = row.querySelector('.l-desc').value;
            const prix = type === 'line' ? row.querySelector('.l-prix').value : "";
            const tva = type === 'line' ? row.querySelector('.l-tva').value : "";
            factureData.lignes.push({ type, desc, prix, tva });
        });

        await addDoc(collection(db, "factures"), factureData);
        alert("Document enregistré avec succès !");
        
    } catch (e) { 
        console.error(e);
        alert("Erreur: " + e.message); 
    }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

// 6. Générer PDF
window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const type = document.getElementById('doc_type').value;
    const numero = document.getElementById('facture_numero').value;

    // --- LOGO & ENTETE ---
    const imgElement = document.getElementById('logo-source');
    if (imgElement) pdf.addImage(imgElement, 'PNG', 15, 15, 35, 35);
    
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
    const nomClient = document.getElementById('facture_nom').value;
    pdf.text(nomClient, 125, 35);
    const adresse = pdf.splitTextToSize(document.getElementById('facture_adresse').value, 70);
    pdf.text(adresse, 125, 42);

    // --- TITRE ---
    let y = 90;
    const sujet = document.getElementById('facture_sujet').value.toUpperCase();
    if(sujet) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    const dateFr = document.getElementById('facture_date').value.split('-').reverse().join('-');
    pdf.text(`${type} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    y += 10;

    // --- TABLEAU ---
    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc').value;
        if (row.dataset.type === 'section') {
            // Titre Section
            rows.push([{
                content: desc, 
                colSpan: 4, 
                styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'}
            }]);
        } else {
            // Ligne Produit
            const tva = row.querySelector('.l-tva').value;
            const prixVal = row.querySelector('.l-prix').value;
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
        styles: { fontSize: 9, cellPadding: 2 }
    });

    // --- TOTAL ---
    let finalY = pdf.lastAutoTable.finalY + 10;
    pdf.setDrawColor(22, 101, 52); pdf.setLineWidth(0.5);
    pdf.rect(140, finalY, 50, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("Total (TTC)", 142, finalY + 8);
    pdf.text(document.getElementById('total-ttc').textContent, 188, finalY + 8, {align:'right'});

    // --- FOOTER ---
    finalY += 25;
    pdf.setFontSize(8); pdf.setTextColor(255, 0, 0); // Rouge
    pdf.text("NB :", 15, finalY);
    pdf.setTextColor(0);
    pdf.text("- (NA) TVA non applicable (0%), art 293 B du CGI", 25, finalY);
    pdf.text("- Conditions de paiement : 100% soit " + document.getElementById('total-ttc').textContent + " à payer à réception", 25, finalY + 5);

    pdf.save(`${type}_${numero}.pdf`);
};