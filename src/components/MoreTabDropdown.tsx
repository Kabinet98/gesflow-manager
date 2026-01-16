import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';

interface MoreTabDropdownProps {
  visible: boolean;
  onClose: () => void;
  items: Array<{
    name: string;
    screen: string;
    icon: any;
  }>;
}

export function MoreTabDropdown({ visible, onClose, items }: MoreTabDropdownProps) {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();

  const handleNavigate = (screen: string) => {
    navigation.navigate(screen);
    onClose();
  };

  // S'assurer que items est toujours un tableau
  let safeItems;
  try {
    if (!items) {
      safeItems = [];
    } else if (!Array.isArray(items)) {
      safeItems = [];
    } else {
      safeItems = items;
    }
  } catch (error: any) {
    safeItems = [];
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              shadowColor: '#000',
            },
          ]}
        >
          {(() => {
            try {
              if (!Array.isArray(safeItems)) {
                return null;
              }
              
              return safeItems.map((item, index) => {
                try {
                  return (
                    <TouchableOpacity
                      key={item.screen}
                      style={[
                        styles.item,
                        index !== safeItems.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: isDark ? '#374151' : '#e5e7eb',
                        },
                      ]}
                      onPress={() => handleNavigate(item.screen)}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={20}
                        color="#0ea5e9"
                      />
                      <Text
                        style={[
                          styles.itemText,
                          {
                            color: isDark ? '#f3f4f6' : '#1f2937',
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                } catch (error: any) {
                  return null;
                }
              });
            } catch (error: any) {
              return null;
            }
          })()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dropdown: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

