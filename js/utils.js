// Récupère la valeur d'un input par son ID
export function getVal(id) { 
    const el = document.getElementById(id); 
    return el ? el.value : ""; 
}

// Formate la date YYYY-MM-DD en JJ/MM/AAAA
export function formatDate(d) { 
    return d ? d.split("-").reverse().join("/") : "................."; 
}

// Gestion du Logo en Base64 (Partagé pour tous les PDF)
export let logoBase64 = null;

export function chargerLogoBase64() {
    const imgElement = document.getElementById('logo-source');
    if (!imgElement || !imgElement.complete || imgElement.naturalWidth === 0) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    ctx.drawImage(imgElement, 0, 0);
    try { logoBase64 = canvas.toDataURL("image/png"); } catch (e) { logoBase64 = null; }
}

// Ajoute le filigrane sur le PDF
export function ajouterFiligrane(pdf) {
    if (logoBase64) {
        try {
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 0.06 }));
            const width = 100; const height = 100; 
            pdf.addImage(logoBase64, 'PNG', (210 - width) / 2, (297 - height) / 2, width, height);
            pdf.restoreGraphicsState();
        } catch(e) {}
    }
}

// En-tête standard des PF Solidaire
export function headerPF(pdf, yPos = 20) {
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(12);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, yPos, { align: "center" });
    pdf.setTextColor(80); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
    pdf.text("32 boulevard Léon Jean Grégory Thuir - TEL : 07.55.18.27.77", 105, yPos + 5, { align: "center" });
    pdf.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042", 105, yPos + 9, { align: "center" });
    pdf.setDrawColor(34, 155, 76); pdf.setLineWidth(0.5);
    pdf.line(40, yPos + 12, 170, yPos + 12);
}