// Store the modes that were deleted for restoration
let deletedModes: {collectionId: string, modeId: string, modeName: string}[] = [];

figma.showUI(__html__, { width: 240, height: 268 });

// Step 1: Send all variable modes to the UI
async function loadModes() {
  try {
    const variableCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const modeData = variableCollections.map(collection => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map(mode => ({ id: mode.modeId, name: mode.name }))
    }));

    figma.ui.postMessage({ type: "load-modes", data: modeData });
  } catch (err) {
    const error = err as Error;
    figma.notify(`Error loading modes: ${error.message}`, { error: true });
    console.error("Error loading modes:", error);
  }
}

loadModes();

// Step 2: Handle UI interactions
figma.ui.onmessage = async (msg) => {
  if (msg.type === "hide-modes") {
    try {
      // Reset stored data
      deletedModes = [];
      
      // For each selected mode
      for (const { collectionId, modeId } of msg.data) {
        console.log(`Attempting to hide mode: ${modeId} from collection: ${collectionId}`);
        
        // Use the async version of getVariableCollectionById
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection) {
          console.error(`Collection not found: ${collectionId}`);
          continue;
        }
        
        console.log(`Collection found: ${collection.name}`);
        console.log(`Collection modes:`, collection.modes);
        
        // Find the mode to delete
        const modeToDelete = collection.modes.find(m => m.modeId === modeId);
        if (!modeToDelete) {
          console.error(`Mode not found: ${modeId}`);
          continue;
        }
        
        console.log(`Mode found: ${modeToDelete.name} (${modeToDelete.modeId})`);
        
        // Store the mode data for restoration
        deletedModes.push({
          collectionId,
          modeId,
          modeName: modeToDelete.name
        });
        
        // Check if this is the only mode in the collection
        if (collection.modes.length <= 1) {
          figma.notify(`Cannot delete the only mode in collection "${collection.name}"`, { error: true });
          console.error(`Cannot delete the only mode in collection "${collection.name}"`);
          continue;
        }
        
        try {
          // Try renaming first to confirm we can access the mode
          const originalName = modeToDelete.name;
          collection.renameMode(modeId, `${originalName}_temp`);
          console.log(`Successfully renamed mode to ${originalName}_temp`);
          
          // Now try to remove the mode
          collection.removeMode(modeId);
          console.log(`Successfully removed mode ${modeId}`);
          
          // Verify the mode was removed
          const modeStillExists = collection.modes.some(m => m.modeId === modeId);
          console.log(`Mode still exists after removal: ${modeStillExists}`);
          
          if (modeStillExists) {
            figma.notify(`Failed to remove mode "${originalName}" - it still exists after removal`, { error: true });
          } else {
            figma.notify(`Mode "${originalName}" hidden successfully`);
          }
        } catch (err) {
          const error = err as Error;
          figma.notify(`Error removing mode: ${error.message}`, { error: true });
          console.error(`Error removing mode: ${error.message}`);
        }
      }
      
      if (deletedModes.length > 0) {
        figma.notify(`${deletedModes.length} mode(s) hidden. Now publish the library.`);
      } else {
        figma.notify("No modes were hidden.");
      }
    } catch (err) {
      const error = err as Error;
      figma.notify(`Error hiding modes: ${error.message}`, { error: true });
      console.error("Error hiding modes:", error);
    }
  }

  if (msg.type === "restore-modes") {
    try {
      let restoredCount = 0;
      
      // For each deleted mode
      for (const { collectionId, modeId, modeName } of deletedModes) {
        console.log(`Attempting to restore mode: ${modeName} to collection: ${collectionId}`);
        
        // Use the async version of getVariableCollectionById
        const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
        if (!collection) {
          console.error(`Collection not found for restoration: ${collectionId}`);
          continue;
        }
        
        console.log(`Collection found for restoration: ${collection.name}`);
        
        try {
          // Add the mode back to the collection using the addMode method
          const newModeId = collection.addMode(modeName);
          console.log(`Successfully added mode ${modeName} with new ID: ${newModeId}`);
          restoredCount++;
        } catch (err) {
          const error = err as Error;
          figma.notify(`Error adding mode: ${error.message}`, { error: true });
          console.error(`Error adding mode: ${error.message}`);
        }
      }
      
      if (restoredCount > 0) {
        figma.notify(`${restoredCount} mode(s) restored.`);
        deletedModes = []; // Clear the deleted modes list
        
        // Reload the modes list
        loadModes();
      } else {
        figma.notify("No modes were restored.");
      }
    } catch (err) {
      const error = err as Error;
      figma.notify(`Error restoring modes: ${error.message}`, { error: true });
      console.error("Error restoring modes:", error);
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
