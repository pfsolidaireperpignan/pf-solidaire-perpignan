import { getVal } from './utils.js';

export function genererPDFFacture() {
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
    pdf.text("SIRET : 539 270 298 00042 - Tél : +33 7 55 18 27 77", 15, 74);

    pdf.setFillColor(240, 240, 240); pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille / Client", 125, 28);
    pdf.setFont("helvetica", "normal");
    pdf.text(getVal('facture_nom'), 125, 35);
    const adresse = pdf.splitTextToSize(getVal('facture_adresse'), 70);
    pdf.text(adresse, 125, 42);

    let y = 90;
    const sujet = getVal('facture_sujet').toUpperCase() || document.getElementById('facture_sujet_select').value;
    if(sujet && sujet !== "AUTRE") {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    let dateFr = getVal('facture_date');
    if(dateFr.includes('-')) dateFr = dateFr.split('-').reverse().join('-');
    pdf.text(`${type} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    
    y += 8;
    const defunt = getVal('facture_defunt');
    if(defunt) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(0);
        pdf.text(`Obsèques de : ${defunt}`, 105, y, {align:"center"});
    }
    y += 10;

    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
        if (row.dataset.type === 'section') {
            rows.push([{ content: desc, colSpan: 4, styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'} }]);
        } else {
            const tva = row.querySelector('.l-tva') ? row.querySelector('.l-tva').value : "";
            const prixVal = row.querySelector('.l-prix') ? row.querySelector('.l-prix').value : 0;
            const prixFmt = parseFloat(prixVal).toFixed(2) + ' €';
            
            const typePrest = row.querySelector('.l-type-prest') ? row.querySelector('.l-type-prest').value : "courant";
            let colCourant = "";
            let colOption = "";
            
            if(typePrest === "courant") colCourant = prixFmt;
            else colOption = prixFmt;

            rows.push([desc, tva, colCourant, colOption]); 
        }
    });

    pdf.autoTable({
        startY: 110,
        head: [['', 'TVA', 'PRIX TTC PRESTATIONS\nCOURANTES', 'PRIX TTC PRESTATIONS\nCOMPLEMENTAIRES\nOPTIONNELLES']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], lineColor: [100, 100, 100], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, valign: 'middle' },
        columnStyles: { 
            0: { cellWidth: 90 }, 
            1: { cellWidth: 15, halign: 'center' }, 
            2: { cellWidth: 40, halign: 'right' }, 
            3: { cellWidth: 40, halign: 'right' } 
        }
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
}