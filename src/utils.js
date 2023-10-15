export function capitalize(str) {
    return str.split('_').map(t => t[0].toUpperCase() + t.slice(1)).join(' ')
        .split('-').map(gg => gg[0].toUpperCase() + gg.slice(1)).join('-');
}

export const releaseRegex = /WEB-DL|WEB-RIP|BluRay|HDTV|HD-RIP|HDTS|HDTC|BR-RIP|BD-RIP|DVDRip|DVDScr|WEBSCR|Mobile|CAMRip|HD-CAM/;
export const releaseRegex2 = /WEBa?-?DL|WEB-?RIP|BluRa?y|B-lu-Ry|HDTV|HD-?RIP|HDTS|HDTC|BR-?RIP|BD-?RIP|P?DVDRip|DVDScr|WEBSCR|CAMRip|HD-CAM/i;

export const encodersRegex = new RegExp([
    /RARBG?|Pa[Hh]e|[Pp][Ss][Aa]|YTS|[Rr][Mm][Tt]eam|EVO|R?MT|Y[Ii]?F[IY]|ShAaNiG|Ganool|Mkv?Cage|Mkvking|GalaxyR?G?|HDTS/,
    /|Digi[Mm](ov|vo)iez|AvaMovie|SalamDL|HDETG|AdiT|GalaxyT[Vv]|DRONES|Joy|Ozlem|NitRo|nItRo|B2HD|GAZ|VXT|([tT]igo(le|el))/,
    /|anoXmous|Judas|ETRG|jbr|Kick|STRiFE|LIMITED|SUNSCREEN|CMRG|sujaidr|[Ss]ilence|xTv|BTRG|TURG|HdT|KRT|DJT|REMARKABLE|[Bb][Tt][Xx]/,
    /|AMRAP|SiGMA|i[Kk][Aa]|LLG|FGT|MkvHub|MW|WiKi|Hon3y|JYK|AME|ELR|NT[GB]|[Nn][Tt]b|eSc|associate|[Ss]c[Oo]rp|RDH|AMZN|afm7[23]/,
    /|Jalucian|muhHD|GAN|AC3|[Ww]orldmkv|AiRLiNE|DEFiNiTE|HazMatt|FiDELiO|AR|monkee|vsenc|BDP|D3FiL3R|watcher|ISRA|[Mm][Kk][Vv][Cc][Aa][Gg][Ee]/,
    /|SaNiG|Frontline|TNTVillage|LordVako|LoRD|titler|rDX|w4f|HighCode|TuGAZx|GCJM|BONE|Qman|Micromkv|d3g|NVEE|AViATOR|GECKOS/,
    /|SUJAIDR|r00t|MovCr|ACOOL|N[Oo]GRP|AAA(UHD)?|DAA|BRSHNKV|HEVCBay|TTL|NBY|KamiKaze|TEPES|MZABI|DEEP|RSG|GOOZ|[Aa][Rr][Ii][Ee][Ss]/,
    /|Tom[Dd]oc|POIASD|SUECOS|Garshasp|SARTRE|Budgetbits|[Pp]rof?|LiBRARiANS|m2g|FreetheFish|[Nn]ickarad|AnimeRG|TombDoc|EDITH|ETHEL/,
    /|FRISKY|3dg|SAMPA|Vyndros|ANONA911|Natty|GetSchwifty|Obey|GSFTX|RONIN|UNK|Bandi|QxR|Paso7[27]|Slinece|SPARKS|PCOK|orenji|LowFatMilk/,
    /|DTSJYK|RZeroX|Omikron|CHD|t3nzin|PAAI|T0M|[Pp]av69|Telugu|RKO?|h3llg0d|M[Hk]UB|Panda|SADPANDA|RKHD|z97|MeGUiL|DMV|BRISK/,
    /|[Aa]pekat|LION|imSamir|KIMO?|Telly|TeamMCU|Grashasp|YOGI|HDSTAr|ViZNU|DREDD|TM[VK]|MHB|EXT|ION10|SECRECY|[RH]?TM|HORiZON/,
    /|Bollycine|InSaNe|ESubs|Lover|FC|COALiTiON|RUSTED|LCK|iExTv|[Ff]2[MmNn]|SH0W|GECK|AMIABLE|KatmovieHD|REM|PRiME|NEZU|TFP|DON/,
    /|SMAHAWUG|CRiSC|STRONTiUM|BdC|HDC|LAZY|FraMeSToR|BAM|Felony|SECTOR7|CADAVER|YOL0W|Replica|KaKa|SPRiNTER|Sprinter|Rapta|REWARD/,
    /|ROVERS|EPSiLON|SAPHiRE|DEFLATE|BRMP|HET|BLOW|DDR|HDL|HAiKU|CiNEFiLE|SNG|FLAME|[Ii][Ff][Tt]|[Tt][Bb][Ss]|EGEN|TOMMY|Tommy|AvoHD|MRN/,
    /|PLUTONiUM|TiTAN|JiO|SKGTV|QPEL|NM|HV|VETO|YST|SHeRiF|C1NEM4|AN0NYM0US|CROOKS|ALTEREGO|SiNNERS|FiCO|mSD|PoOlLa|MAX|GETiT|IFR/,
    /|ALLiANCE|DiAMOND|Team-x265|PECULATE|TIMECUT|MRCS|NAISU|PMV|SCENI|Atmos|PSYCHD|DEMAND|GOPISAHI|MkHub|VFX|[Xx][Ll][Ff]|RBX|DSNP|VIU/,
    /|HS|LINETV|SMURF|CPNG|TVING|[Vv][Ii][Kk][Ii]|[Kk][Oo][Gg][Ii]|IQ|mottoj|Cleo|BORDURE|CtrlHD|DIMENSION|dimension|DSNY|AVS|KILLERS/,
    /|ALiGN|FLEET|lucidtv|SVA|IMMERSE|WebCakes|[Cc][Aa][Kk][Ee][Ss]|IchiMaruGin|BTN|PTV|Improbable|Providence|Provenance|NFP|TVSmash?|MeGusta/,
    /|SEEZN|NOSiViD|Kirion|DeeJayAhmed|GHOSTS|Rudaki|ATVP|[Mm][Ii][Nn][Xx]|SYNCOPY|XpoZ|[Ll][Oo][Kk][Ii]|[Pp][Aa][Hh][Ee]|CRYPTIC|RyRo|GDL/,
    /|Teamx265|[Mm]TEAM|TayTO|Reaktor|Luvmichelle|TrueHD|Stamo|xRed|RCVR|EVOLVE|killers|WDYM|APEX|LiHDL|FLUX|bamboozle|CfaMilyRG|WELP|XEBEC|IC/,
].map(item => item.source).join(''));