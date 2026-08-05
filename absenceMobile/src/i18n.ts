import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  fr: {
    translation: {
      mon_profil: "Mon Profil",
      parametres: "Paramètres",
      deconnexion: "Déconnexion",
      bonjour: "Bonjour",
      espace_formateur: "Espace Formateur",
      nom_prenom: "Nom & Prénom",
      pres_abs: "P/A",
      lock_session: "Verrouiller",
      unlock_session: "Déverrouiller",
      send_to_ofppt: "Envoyer à l'OFPPT",
      select_language: "Choisir la langue",
      save: "Enregistrer",
      cancel: "Annuler",
      all: "Tous",
      year: "Année",
      group: "Groupe",
      no_students: "Aucun étudiant sélectionné",
      synchronizing: "Synchronisation...",
    }
  },
  en: {
    translation: {
      mon_profil: "My Profile",
      parametres: "Settings",
      deconnexion: "Logout",
      bonjour: "Hello",
      espace_formateur: "Instructor Space",
      nom_prenom: "Name & Surname",
      pres_abs: "P/A",
      lock_session: "Lock",
      unlock_session: "Unlock",
      send_to_ofppt: "Send to OFPPT",
      select_language: "Select Language",
      save: "Save",
      cancel: "Cancel",
      all: "All",
      year: "Year",
      group: "Group",
      no_students: "No students selected",
      synchronizing: "Synchronizing...",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr',
    fallbackLng: 'fr',
    react: {
      useSuspense: false
    },
    interpolation: {
      escapeValue: false,
    }
  });

// Load language after init
const loadLanguage = async () => {
  try {
    const lng = await AsyncStorage.getItem('@user_language');
    if (lng) {
      i18n.changeLanguage(lng);
    }
  } catch (err) {
    console.log('Error loading language', err);
  }
};
loadLanguage();

export default i18n;
