import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VOTRE CONFIGURATION (Déjà collée) ---
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

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('facture_date').value = new Date().toISOString().split('T')[0];
    
    // Chargement Clients pour recherche
    const datalist = document.getElementById('clients-datalist');
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

    // Exemple de structure comme sur l'image
    window.ajouterTitreSection("1. PRESTATIONS");
    window.ajouterLigne("Cercueil", "NA", 850);
});

// --- AUTO-COMPLETE ---
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

// --- GESTION TABLEAU ---
window.ajouterLigne = function(desc = "", tva = "NA", prix = 0) {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "line";
    tr.innerHTML = `
        <td style="padding-left:10px;"><input class="l-desc" value="${desc}" placeholder="Désignation"></td>
        <td style="text-align:center;"><input class="l-tva" value="${tva}" style="text-align:center;"></td>
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
    tr.className = "section-row"; // Classe CSS pour fond orange
    tr.innerHTML = `
        <td colspan="4"><input class="l-desc" value="${titre}" style="font-weight:bold; color:#9a3412; padding-left:10px;"></td>
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

// --- SAUVEGARDE ---
window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    btn.innerHTML = 'Envoi...';
    
    const nom = document.getElementById('facture_nom').value;
    if(!nom) { btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer'; return alert("Nom du client manquant"); }

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

        document.querySelectorAll('#lines-body tr').forEach(row => {
            const type = row.dataset.type;
            const desc = row.querySelector('.l-desc').value;
            const prix = type === 'line' ? row.querySelector('.l-prix').value : "";
            const tva = type === 'line' ? row.querySelector('.l-tva').value : "";
            factureData.lignes.push({ type, desc, prix, tva });
        });

        await addDoc(collection(db, "factures"), factureData);
        alert("Enregistré avec succès !");
        
    } catch (e) { alert("Erreur: " + e.message); }
    btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

// --- GENERATION PDF (Style Modèle Image) ---
window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const type = document.getElementById('doc_type').value;
    const numero = document.getElementById('facture_numero').value;

    // 1. LOGO & ENTETE
    const imgElement = document.getElementById('logo-source');
    if (imgElement) pdf.addImage(imgElement, 'PNG', 15, 15, 30, 30);
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); // Vert
    pdf.text("POMPES FUNEBRES", 15, 50);
    pdf.text("SOLIDAIRE PERPIGNAN", 15, 55);
    
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("32 boulevard Léon Jean Grégory Thuir - FRANCE", 15, 62);
    pdf.text("pfsolidaireperpignan@gmail.com", 15, 66);
    pdf.text("SIRET : 539 270 298 00042", 15, 70);
    pdf.text("Tél : +33 7 55 18 27 77", 15, 74);

    // 2. CADRE FAMILLE (Gris)
    pdf.setFillColor(240, 240, 240); 
    pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille", 125, 28);
    pdf.setFont("helvetica", "normal");
    const nomClient = document.getElementById('facture_nom').value;
    pdf.text(nomClient, 125, 35);
    const adresse = pdf.splitTextToSize(document.getElementById('facture_adresse').value, 70);
    pdf.text(adresse, 125, 42);

    // 3. TITRE & SUJET
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

    // 4. TABLEAU (Style Modèle)
    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc').value;
        
        if (row.dataset.type === 'section') {
            // Ligne de titre (Fond Orange)
            rows.push([{
                content: desc, 
                colSpan: 4, 
                styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'}
            }]);
        } else {
            // Ligne normale
            const tva = row.querySelector('.l-tva').value;
            const prix = row.querySelector('.l-prix').value;
            const prixTxt = prix ? parseFloat(prix).toFixed(2) + ' €' : '';
            // Colonne 3 = Prix Courant, Colonne 4 = Optionnel (Vide pour l'instant)
            rows.push([desc, tva, prixTxt, ""]); 
        }
    });

    pdf.autoTable({
        startY: y,
        head: [['', 'TVA', 'PRIX TTC PRESTATIONS\nCOURANTES', 'PRIX TTC PRESTATIONS\nCOMPLEMENTAIRES\nOPTIONNELLES']],
        body: rows,
        theme: 'grid',
        headStyles: { 
            fillColor: [220, 252, 231], // Vert très clair
            textColor: [0, 0, 0], 
            lineColor: [100, 100, 100], 
            lineWidth: 0.1,
            halign: 'center',
            valign: 'middle'
        },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
        columnStyles: { 
            0: { cellWidth: 90 }, 
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 40, halign: 'right' }
        }
    });

    // 5. TOTAL
    let finalY = pdf.lastAutoTable.finalY + 5;
    
    // Cadre Total (Vert contour)
    pdf.setDrawColor(22, 101, 52); pdf.setLineWidth(0.5);
    pdf.rect(140, finalY, 50, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("Total (TTC)", 142, finalY + 8);
    pdf.text(document.getElementById('total-ttc').textContent, 188, finalY + 8, {align:'right'});

    // 6. PIED DE PAGE (Mentions Rouges)
    finalY += 25;
    pdf.setFontSize(8); pdf.setTextColor(255, 0, 0); // Rouge
    pdf.text("NB :", 15, finalY);
    pdf.setTextColor(0); // Noir
    pdf.text("- (NA) TVA non applicable (0%), art 293 B du CGI", 25, finalY);
    pdf.text("- Conditions de paiement : 100% soit " + document.getElementById('total-ttc').textContent + " à payer à réception", 25, finalY + 5);

    pdf.save(`${type}_${numero}.pdf`);
};