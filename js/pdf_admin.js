import { getVal, formatDate, logoBase64, chargerLogoBase64, ajouterFiligrane, headerPF } from './utils.js';

// --- 1. POUVOIR ---
export function genererPouvoir() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    ajouterFiligrane(pdf); headerPF(pdf);
    
    let typePresta = getVal("prestation").toUpperCase();
    if(typePresta === "RAPATRIEMENT") typePresta += ` vers ${getVal("rap_pays").toUpperCase()}`;
    
    pdf.setFillColor(241, 245, 249); pdf.rect(20, 45, 170, 12, 'F');
    pdf.setFontSize(16); pdf.setTextColor(185, 28, 28); pdf.setFont("helvetica", "bold");
    pdf.text("POUVOIR", 105, 53, { align: "center" });
    
    pdf.setFontSize(10); pdf.setTextColor(0);
    let y = 75; const x = 25;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Je soussigné(e) : ${getVal("soussigne")}`, x, y); y+=8;
    pdf.text(`Demeurant à : ${getVal("demeurant")}`, x, y); y+=8;
    pdf.text(`Agissant en qualité de : ${getVal("lien")}`, x, y); y+=15;
    pdf.text("Ayant qualité pour pourvoir aux funérailles de :", x, y); y+=8;
    
    pdf.setDrawColor(200); pdf.setFillColor(250); pdf.rect(x-5, y-5, 170, 40, 'FD');
    pdf.setFont("helvetica", "bold");
    pdf.text(`${getVal("nom")} ${getVal("prenom")}`, x, y+2); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) le ${formatDate(getVal("date_naiss"))} à ${getVal("lieu_naiss")}`, x, y); y+=6;
    pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x, y); y+=6;
    pdf.text(`Domicile : ${getVal("adresse_fr")}`, x, y); y+=12;
    
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(185, 28, 28);
    pdf.text(`POUR : ${typePresta}`, 105, y, {align:"center"}); y+=15;
    
    pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
    pdf.text("Donne mandat aux PF SOLIDAIRE PERPIGNAN pour :", x, y); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text("- Effectuer toutes les démarches administratives.", x+5, y); y+=6;
    pdf.text("- Signer toute demande d'autorisation nécessaire.", x+5, y); y+=6;
    if(typePresta.includes("RAPATRIEMENT")) {
        pdf.text("- Accomplir les formalités consulaires et douanières.", x+5, y); y+=6;
        pdf.text("- Organiser le transport aérien ou terrestre.", x+5, y); y+=6;
    }
    y = 240;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("Signature du Mandant", 150, y, { align: "center" });
    pdf.save(`Pouvoir_${getVal("nom")}.pdf`);
}

// --- 2. DÉCLARATION DÉCÈS ---
export function genererDeclaration() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const fontMain = "times";
    
    pdf.setFont(fontMain, "bold"); pdf.setFontSize(16);
    pdf.text("DECLARATION DE DECES", 105, 30, { align: "center" });
    pdf.setLineWidth(0.5); pdf.line(75, 31, 135, 31);
    pdf.setFontSize(11);
    pdf.text("Dans tous les cas à remettre obligatoirement complété et signé", 105, 38, { align: "center" });
    pdf.line(55, 39, 155, 39);
    
    let y = 60; const margin = 20;
    const drawLine = (label, val, yPos) => {
        pdf.setFont(fontMain, "bold"); pdf.text(label, margin, yPos);
        const startDots = margin + pdf.getTextWidth(label) + 2;
        let curX = startDots; pdf.setFont(fontMain, "normal");
        while(curX < 190) { pdf.text(".", curX, yPos); curX += 2; }
        if(val) {
            pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255);
            pdf.rect(startDots, yPos - 4, pdf.getTextWidth(val)+5, 5, 'F');
            pdf.text(val.toUpperCase(), startDots + 2, yPos);
        }
    };
    
    drawLine("NOM : ", getVal("nom"), y); y+=14;
    drawLine("NOM DE JEUNE FILLE : ", getVal("nom_jeune_fille"), y); y+=14;
    drawLine("Prénoms : ", getVal("prenom"), y); y+=14;
    drawLine("Né(e) le : ", formatDate(getVal("date_naiss")), y); y+=14;
    drawLine("A : ", getVal("lieu_naiss"), y); y+=14;
    
    pdf.setFont(fontMain, "bold"); pdf.text("DATE ET LIEU DU DECES LE", margin, y);
    pdf.setFont(fontMain, "normal"); let dots = margin + 65; while(dots < 115) { pdf.text(".", dots, y); dots+=2; }
    if(getVal("date_deces")) { 
        pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255); 
        pdf.rect(margin+66, y-4, 25, 5, 'F'); 
        pdf.text(formatDate(getVal("date_deces")), margin+67, y); 
    }
    pdf.setFont(fontMain, "bold"); pdf.text("A", 120, y); dots = 125; while(dots < 190) { pdf.text(".", dots, y); dots+=2; }
    if(getVal("lieu_deces")) { 
        pdf.setFillColor(255, 255, 255); pdf.rect(126, y-4, 60, 5, 'F'); 
        pdf.text(getVal("lieu_deces").toUpperCase(), 127, y); 
    }
    y += 6; pdf.setFont(fontMain, "bold"); pdf.text("(en son domicile, en clinique, à l'hôpital", margin, y);
    pdf.line(margin, y+1, margin + 75, y+1); pdf.text(")", margin + 75, y); y += 18;
    
    pdf.text("PROFESSION : ", margin, y); y+=8;
    const prof = document.querySelector('input[name="prof_type"]:checked') ? document.querySelector('input[name="prof_type"]:checked').value : "";
    
    pdf.rect(margin+5, y-4, 5, 5); if(prof === "Sans profession") pdf.text("X", margin+6, y);
    pdf.setFont(fontMain, "normal"); pdf.text("Sans profession", margin+15, y);
    
    pdf.rect(margin+60, y-4, 5, 5); if(prof === "Retraité(e)") pdf.text("X", margin+61, y);
    pdf.text("retraité(e)", margin+70, y);
    
    if(prof === "autre") pdf.text(`Autre : ${getVal("profession_autre")}`, margin+110, y); y += 15;
    
    drawLine("DOMICILIE(E) ", getVal("adresse_fr"), y); y+=14;
    drawLine("FILS OU FILLE de (Père) :", getVal("pere"), y); y+=14;
    drawLine("Et de (Mère) :", getVal("mere"), y); y+=14;
    drawLine("Situation Matrimoniale : ", getVal("matrimoniale"), y); y+=14;
    drawLine("NATIONALITE : ", getVal("nationalite"), y); y+=25;
    
    pdf.setFont(fontMain, "bold"); pdf.text("NOM ET SIGNATURE DES POMPES FUNEBRES EN CHARGE DES OBSEQUES", 105, y, { align: "center" });
    y = 280; pdf.setFont(fontMain, "italic"); pdf.setFontSize(10); pdf.text("Aucun acte ne pourra être dressé si le document est incomplet", margin, y);
    pdf.save(`Declaration_Deces_${getVal("nom")}.pdf`);
}

// --- 3. DEMANDE INHUMATION ---
export function genererDemandeInhumation() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    headerPF(pdf);
    pdf.setFillColor(230, 240, 230); pdf.rect(20, 40, 170, 10, 'F');
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("DEMANDE D'INHUMATION", 105, 47, { align: "center" });
    let y = 70; const x = 25;
    pdf.setFontSize(11); pdf.text("Monsieur le Maire,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné M. CHERKAOUI Mustapha, dirigeant des PF Solidaire,", x, y); y+=6;
    pdf.text("Sollicite l'autorisation d'inhumer le défunt :", x, y); y+=12;
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+10, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+10, y); y+=15;
    pdf.text("Lieu d'inhumation :", x, y); y+=6;
    pdf.setFont("helvetica", "bold"); pdf.text(`Cimetière : ${getVal("cimetiere_nom")}`, x+10, y); y+=6;
    pdf.text(`Le : ${formatDate(getVal("date_inhumation"))} à ${getVal("heure_inhumation")}`, x+10, y); y+=6;
    pdf.text(`Concession : ${getVal("num_concession")} (${getVal("type_sepulture")})`, x+10, y); y+=20;
    pdf.setFont("helvetica", "normal"); pdf.text("Veuillez agréer, Monsieur le Maire, mes salutations distinguées.", x, y); y+=20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 130, y);
    pdf.save(`Demande_Inhumation_${getVal("nom")}.pdf`);
}

// --- 4. DEMANDE CRÉMATION ---
export function genererDemandeCremation() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text(getVal("soussigne"), 20, 45); 
    pdf.setFont("times", "normal"); pdf.text(getVal("demeurant"), 20, 51);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("Monsieur le Maire", 150, 60, {align:"center"});
    pdf.setFontSize(12); pdf.text("OBJET : DEMANDE D'AUTORISATION DE CREMATION", 20, 80);
    let y = 100;
    pdf.setFont("times", "normal");
    const txt = `Monsieur le Maire,

Je soussigné(e) ${getVal("soussigne")}, agissant en qualité de ${getVal("lien")} du défunt(e), sollicite l'autorisation de procéder à la crémation de :

${getVal("nom").toUpperCase()} ${getVal("prenom")}
Né(e) le ${formatDate(getVal("date_naiss"))} et décédé(e) le ${formatDate(getVal("date_deces"))}.

La crémation aura lieu le ${formatDate(getVal("date_cremation"))} au ${getVal("crematorium_nom")}.
Destination des cendres : ${getVal("destination_cendres")}.

Je certifie que le défunt n'était pas porteur d'un stimulateur cardiaque.`;
    const splitTxt = pdf.splitTextToSize(txt, 170); pdf.text(splitTxt, 20, y);
    y += (splitTxt.length * 7) + 20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 120, y);
    pdf.setFont("times", "bold"); pdf.text("Signature", 120, y+8);
    pdf.save(`Demande_Cremation_${getVal("nom")}.pdf`);
}

// --- 5. RAPATRIEMENT ---
export function genererDemandeRapatriement() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setDrawColor(0); pdf.setLineWidth(0.5); pdf.setFillColor(240, 240, 240);
    pdf.rect(15, 20, 180, 20, 'FD');
    pdf.setTextColor(0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'AUTORISATION DE TRANSPORT DE CORPS", 105, 32, {align:"center"});

    let y = 60; const x = 15;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné(e) (nom et prénom) : CHERKAOUI MUSTPAHA", x, y); y+=6;
    pdf.text("Représentant légal de : ", x, y);
    pdf.setFont("helvetica", "normal");
    pdf.text("Pompes Funèbres Solidaire Perpignan, 32 boulevard Léon Jean Grégory Thuir", x+45, y); y+=6;
    pdf.setFont("helvetica", "bold");
    pdf.text("Habilitée sous le n° : 23-66-0205", x, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("Dûment mandaté par la famille de la défunte, sollicite l'autorisation de faire transporter en dehors du", x, y); y+=5;
    pdf.text("territoire métropolitain le corps après mise en bière de :", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nom et prénom de la défunte : ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date et lieu de naissance    : ${formatDate(getVal("date_naiss"))}       à     ${getVal("lieu_naiss")}`, x, y); y+=6;
    pdf.text(`Décédé le                         : ${formatDate(getVal("date_deces"))}       à     ${getVal("lieu_deces")}`, x, y); y+=10;
    pdf.text(`Fille de (père) : ${getVal("pere")}`, x, y); y+=6;
    pdf.text(`et de (mère) : ${getVal("mere")}`, x, y); y+=6;
    const conj = getVal("conjoint") ? getVal("conjoint") : "";
    pdf.text(`Situation familiale : Époux/se de ${conj}`, x, y); y+=10;
    
    pdf.setFont("helvetica", "bold"); pdf.setLineWidth(0.5);
    pdf.text("Moyen de transport :", x+5, y); 
    pdf.line(x+5, y+1, x+45, y+1); y+=10;
    
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+10, y-3, 3, 3, 'F'); pdf.text("Par voie routière :", x+15, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`- Avec le véhicule funéraire immatriculé : ${getVal("rap_immat")}`, x+20, y); y+=5;
    pdf.text(`- Date et heure de départ le : ${getVal("rap_date_dep_route")}`, x+20, y); y+=5;
    pdf.text(`- Lieu de départ : ${getVal("rap_ville_dep")}`, x+20, y); y+=5;
    pdf.text(`- Commune et pays d'arrivée : ${getVal("rap_ville_arr")}`, x+20, y); y+=10;
    
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+10, y-3, 3, 3, 'F'); pdf.text("Par voie aérienne :", x+15, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`- Numéro de LTA : ${getVal("rap_lta")}`, x+20, y); y+=6;
    if(getVal("vol1_num")) {
        pdf.setFont("helvetica", "bold");
        pdf.text(`- vol : ${getVal("vol1_num")}`, x+20, y); y+=5;
        pdf.setFont("helvetica", "normal");
        pdf.text(`  > Départ :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport de départ : ${getVal("vol1_dep_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure de départ le : ${getVal("vol1_dep_time")}`, x+30, y); y+=5;
        pdf.text(`  > Arrivée :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport d'Arrivée : ${getVal("vol1_arr_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure d'arrivée le : ${getVal("vol1_arr_time")}`, x+30, y); y+=8;
    }
    const chk = document.getElementById('check_vol2');
    if(chk && chk.checked && getVal("vol2_num")) {
        pdf.setFont("helvetica", "bold");
        pdf.text(`- vol : ${getVal("vol2_num")}`, x+20, y); y+=5;
        pdf.setFont("helvetica", "normal");
        pdf.text(`  > Départ :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport de départ : ${getVal("vol2_dep_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure de départ le : ${getVal("vol2_dep_time")}`, x+30, y); y+=5;
        pdf.text(`  > Arrivée :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport d'Arrivée : ${getVal("vol2_arr_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure d'arrivée le : ${getVal("vol2_arr_time")}`, x+30, y); y+=8;
    }
    y+=5;
    pdf.text(`Lieu d'inhumation du corps (Ville – Pays) : ${getVal("rap_ville")} / ${getVal("rap_pays")}`, x, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à   : ${getVal("faita")}`, 140, y); y+=6;
    pdf.text(`Le        : ${formatDate(getVal("dateSignature"))}`, 140, y); y+=15;
    pdf.text("Signature et cachet", 140, y);
    pdf.save(`Demande_Rapatriement_Prefecture_${getVal("nom")}.pdf`);
}

// --- 6. FERMETURE CERCUEIL MAIRIE ---
export function genererDemandeFermetureMairie() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setDrawColor(26, 90, 143); pdf.setLineWidth(1.5); pdf.rect(10, 10, 190, 277);
    headerPF(pdf);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 90, 143); pdf.setFontSize(16);
    pdf.text("DEMANDE D'AUTORISATION DE FERMETURE", 105, 45, { align: "center" });
    pdf.text("DE CERCUEIL", 105, 53, { align: "center" });
    let y = 80; const x = 25;
    pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné :", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Nom et Prénom : M. CHERKAOUI Mustapha", x+10, y); y+=8;
    pdf.text("• Qualité : Dirigeant PF Solidaire Perpignan", x+10, y); y+=8;
    pdf.text("• Adresse : 32 Bd Léon Jean Grégory, Thuir", x+10, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text("A l'honneur de solliciter votre autorisation de fermeture du cercueil de :", x, y); y+=15;
    pdf.setFillColor(245, 245, 245); pdf.rect(x-5, y-5, 170, 35, 'F');
    pdf.text("• Nom et Prénom : " + getVal("nom").toUpperCase() + " " + getVal("prenom"), x+10, y); y+=10;
    pdf.text("• Né(e) le : " + formatDate(getVal("date_naiss")) + " à " + getVal("lieu_naiss"), x+10, y); y+=10;
    pdf.text("• Décédé(e) le : " + formatDate(getVal("date_deces")) + " à " + getVal("lieu_deces"), x+10, y); y+=20;
    pdf.text("Et ce,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Le : " + formatDate(getVal("date_fermeture")), x+10, y); y+=10;
    pdf.text("• A (Lieu) : " + getVal("lieu_fermeture"), x+10, y); y+=30;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, x, y);
    pdf.save(`Demande_Fermeture_${getVal("nom")}.pdf`);
}

// --- 7. OUVERTURE SÉPULTURE ---
export function genererDemandeOuverture() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const type = getVal("prestation");
    headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'OUVERTURE D'UNE SEPULTURE DE FAMILLE", 105, 40, {align:"center"});
    let y = 55; 
    pdf.setFontSize(12);
    pdf.text("POUR", 25, y);
    pdf.rect(45, y-4, 8, 8); 
    if(type === "Inhumation") { pdf.text("X", 47, y+2); }
    pdf.text("INHUMATION", 55, y);
    pdf.rect(95, y-4, 8, 8);
    if(type === "Exhumation") { pdf.text("X", 97, y+2); }
    pdf.text("EXHUMATION", 105, y);
    pdf.rect(145, y-4, 8, 8);
    pdf.text("SCELLEMENT D'URNE", 155, y);
    y += 20; const x = 20;
    pdf.setFont("times", "normal");
    pdf.text("Nous soussignons :", x, y); y+=8;
    pdf.text(`- Nom et Prénom :`, x+10, y); 
    pdf.setFont("times", "bold"); pdf.text(getVal("soussigne"), x+50, y);
    pdf.setFont("times", "normal"); pdf.text(`Lien de parenté :`, x+110, y);
    pdf.setFont("times", "bold"); pdf.text(getVal("lien"), x+145, y); y+=15;
    pdf.rect(x-2, y-2, 3, 3, 'F'); pdf.text("Demandons à faire :", x+5, y); y+=8;
    pdf.setFont("times", "bold");
    if(type === "Exhumation") pdf.text("Exhumer le corps dans la concession :", x+5, y);
    else pdf.text("Ouvrir la concession pour inhumation :", x+5, y);
    y+=8;
    pdf.setFont("times", "normal");
    pdf.text(`n° ${getVal("num_concession")}   acquise par : ${getVal("titulaire_concession")}`, x+10, y); y+=12;
    pdf.setFont("times", "bold"); pdf.text(`${getVal("nom")} ${getVal("prenom")}`, x+30, y);
    pdf.setFont("times", "normal"); pdf.text("né(e) le", x+90, y);
    pdf.setFont("times", "bold"); pdf.text(formatDate(getVal("date_naiss")), x+105, y);
    pdf.setFont("times", "normal"); pdf.text(`à ${getVal("lieu_naiss")}`, x+135, y); y+=8;
    pdf.text(`Qui demeurait à : ${getVal("adresse_fr")}`, x+5, y); y+=8;
    pdf.text(`Décédé(e) le : ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+5, y); y+=15;
    pdf.rect(x-2, y-2, 3, 3, 'F');
    pdf.setFont("times", "bold"); pdf.text("Mandatons et donnons pouvoir à l'entreprise de pompes funèbres ci-dessus mentionnée", x+5, y); y+=5;
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, y, {align:"center"}); y+=8;
    pdf.setFont("times", "normal");
    pdf.text("D'exécuter les travaux d'ouverture et fermeture ou scellement d'une urne relatifs à l'opération", x, y); y+=5;
    pdf.text("funéraire ci-dessus mentionnée", x, y); y+=8;
    pdf.text(`M : ..........................`, x, y); pdf.setFont("times", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+40, y); y+=6;
    pdf.setFont("times", "normal");
    pdf.text(`Pompes Funèbres à .........`, x, y); pdf.setFont("times", "bold"); pdf.text("32 boulevard Léon Jean Grégory Thuir", x+45, y); y+=15;
    pdf.setFont("times", "bold");
    pdf.text("Date et heure de l'inhumation au cimetière de l'exhumation du scellement", x, y); y+=10;
    pdf.text("..........................................................................................................................................", x, y); y+=15;
    pdf.setFontSize(10); pdf.setFont("times", "normal");
    const txt = "La présente déclaration dont j'assure la peine et entière responsabilité m'engage à garantir la ville contre toute réclamation qui pourrait survenir suite à l'inhumation l'exhumation ou le scellement d'urne qui en fait objet.\n\nEnfin conférèrent à la réglementation en vigueur je m'engage à fournir la preuve de la qualité du ou des ayants droits (livret de famille, acte de naissance, attestation notariée etc.) et déposer ou service Réglementation funéraire de la ville, la copie du ou des document(s) précité prouvant la qualité du ou des ayants droits";
    const splitTxt = pdf.splitTextToSize(txt, 170);
    pdf.text(splitTxt, x, y);
    y += 40;
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text("Signature des déclarants", 140, y);
    pdf.save(`Ouverture_Sepulture_${getVal("nom")}.pdf`);
}

// --- 8. PV FERMETURE (TECHNIQUE) ---
export function genererFermeture() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    ajouterFiligrane(pdf);
    headerPF(pdf);
    pdf.setFillColor(52, 73, 94); pdf.rect(0, 35, 210, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(255, 255, 255);
    pdf.text("PROCÈS-VERBAL DE FERMETURE DE CERCUEIL", 105, 45, { align: "center" });
    pdf.setTextColor(0); pdf.setFontSize(10);
    let y = 65; const x = 20;
    pdf.setDrawColor(200); pdf.setLineWidth(0.5); pdf.rect(x, y, 170, 20);
    pdf.setFont("helvetica", "bold"); pdf.text("L'OPÉRATEUR FUNÉRAIRE", x+5, y+5);
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon Jean Grégory, Thuir", x+5, y+10);
    pdf.text("Habilitation : 23-66-0205", x+5, y+15); y += 30;
    pdf.text("Nous, soussignés, certifions avoir procédé à la fermeture et au scellement du cercueil.", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`DATE : ${formatDate(getVal("date_fermeture"))}`, x, y);
    pdf.text(`LIEU : ${getVal("lieu_fermeture")}`, x+80, y); y+=15;
    pdf.setFillColor(240, 240, 240); pdf.rect(x, y, 170, 30, 'F');
    pdf.setFont("helvetica", "bold"); pdf.text("IDENTITÉ DU DÉFUNT(E)", x+5, y+6);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nom : ${getVal("nom").toUpperCase()}`, x+5, y+14); pdf.text(`Prénom : ${getVal("prenom")}`, x+80, y+14);
    pdf.text(`Né(e) le : ${formatDate(getVal("date_naiss"))}`, x+5, y+22); pdf.text(`Décédé(e) le : ${formatDate(getVal("date_deces"))}`, x+80, y+22); y+=40;
    const isPolice = document.querySelector('input[name="type_presence"][value="police"]').checked;
    pdf.setFont("helvetica", "bold"); pdf.text("EN PRÉSENCE DE :", x, y); y+=10;
    pdf.rect(x, y, 170, 30);
    if(isPolice) {
        pdf.text("AUTORITÉ DE POLICE (Absence de famille)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom & Grade : ${getVal("p_nom_grade")}`, x+5, y+14);
        pdf.text(`Commissariat : ${getVal("p_commissariat")}`, x+5, y+22);
    } else {
        pdf.text("LA FAMILLE", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom : ${getVal("f_nom_prenom")}`, x+5, y+14);
        pdf.text(`Lien de parenté : ${getVal("f_lien")}`, x+80, y+14);
        pdf.text(`Domicile : ${getVal("f_adresse")}`, x+5, y+22);
    }
    y+=45;
    pdf.line(20, y, 190, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature Opérateur", 40, y);
    pdf.text(isPolice ? "Signature Police" : "Signature Famille", 140, y);
    pdf.save(`PV_Fermeture_${getVal("nom")}.pdf`);
}

// --- 9. TRANSPORT ---
export function genererTransport() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setLineWidth(1); pdf.rect(10, 10, 190, 277);
    headerPF(pdf);
    pdf.setFillColor(200); pdf.rect(10, 35, 190, 15, 'F');
    const typeT = document.querySelector('input[name="transport_type"]:checked').value;
    const labelT = typeT === "avant" ? "AVANT MISE EN BIÈRE" : "APRÈS MISE EN BIÈRE";
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text(`DÉCLARATION DE TRANSPORT DE CORPS`, 105, 42, { align: "center" });
    pdf.setFontSize(12); pdf.text(labelT, 105, 47, { align: "center" });
    let y = 70; const x = 20;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("TRANSPORTEUR :", x, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon J. Grégory, Thuir", x, y); y+=15;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 25);
    pdf.setFont("helvetica", "bold"); pdf.text("DÉFUNT(E)", x+5, y+6);
    pdf.setFontSize(14); pdf.text(`${getVal("nom")} ${getVal("prenom")}`, 105, y+15, {align:"center"});
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) le ${formatDate(getVal("date_naiss"))}`, 105, y+21, {align:"center"}); y+=35;
    pdf.setLineWidth(0.5); pdf.rect(x, y, 80, 50); pdf.rect(x+90, y, 80, 50);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU DE DÉPART", x+5, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal("lieu_depart_t"), x+5, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+5, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal("date_depart_t"))} à ${getVal("heure_depart_t")}`, x+5, y+42);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU D'ARRIVÉE", x+95, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal("lieu_arrivee_t"), x+95, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+95, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal("date_arrivee_t"))} à ${getVal("heure_arrivee_t")}`, x+95, y+42); y+=60;
    pdf.setFillColor(230); pdf.rect(x, y, 170, 10, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.text(`VÉHICULE AGRÉÉ IMMATRICULÉ : ${getVal("immatriculation")}`, 105, y+7, {align:"center"}); y+=30;
    pdf.text(`Fait à ${getVal("faita_transport")}, le ${formatDate(getVal("dateSignature_transport"))}`, 120, y);
    pdf.text("Cachet de l'entreprise :", 120, y+10);
    pdf.save(`Transport_${getVal("nom")}.pdf`);
}