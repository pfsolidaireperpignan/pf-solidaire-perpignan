const v = (id) => document.getElementById(id).value || "";
const formatD = (d) => d ? d.split("-").reverse().join("/") : ".................";
const font = "helvetica";

window.onload = () => {
    document.getElementById('faita').value = "Perpignan";
    document.getElementById('dateSignature').value = new Date().toISOString().split('T')[0];
};

function toggleProf(isAutre) { document.getElementById('profession_autre').disabled = !isAutre; }

function toggleConjoint() {
    const sit = document.getElementById("matrimoniale").value;
    const isActive = (sit === "Marié(e)" || sit === "Veuf(ve)" || sit === "Divorcé(e)");
    document.getElementById("conjoint").disabled = !isActive;
}

function getProf() {
    const radios = document.getElementsByName('prof_type');
    for (const r of radios) {
        if (r.checked) return r.value === "autre" ? v("profession_autre") : r.value;
    }
    return "";
}

function getSituationComplete() {
    const sit = v("matrimoniale");
    const conj = v("conjoint");
    const conjElt = document.getElementById("conjoint");
    if (conj && !conjElt.disabled) {
        return (sit === "Marié(e)") ? `${sit} à ${conj}` : `${sit} de ${conj}`;
    }
    return sit;
}

function dessinerCadre(pdf) {
    pdf.setDrawColor(26, 90, 143); pdf.setLineWidth(0.8); pdf.rect(5, 5, 200, 287);
    pdf.setLineWidth(0.2); pdf.rect(6.5, 6.5, 197, 284);
    pdf.setFont(font, "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(11);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, 15, { align: "center" });
    pdf.setTextColor(0); pdf.setFontSize(8); pdf.setFont(font, "normal");
    pdf.text("32 boulevard Léon Jean Grégory Thuir - TEL : 0755182777", 105, 20, { align: "center" });
    pdf.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042", 105, 24, { align: "center" });
}

function helperLignePropre(pdf, txt, val, x, y, dotStart, dotEnd = 185) {
    pdf.setFont(font, "bold"); pdf.text(txt, x, y);
    pdf.setFont(font, "normal");
    let curX = dotStart || (x + pdf.getTextWidth(txt) + 5);
    pdf.text(" : ", curX - 5, y);
    while (curX < dotEnd) { pdf.text(".", curX, y); curX += 1.5; }
    if (val) {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(dotStart + 2, y - 4, pdf.getTextWidth(val) + 2, 5, 'F');
        pdf.setFont(font, "bold"); pdf.text(val, dotStart + 3, y);
    }
}

// Les fonctions de génération (genererPouvoir, genererDeclaration, etc.) 
// sont à copier-coller ici depuis votre code original sans modification.