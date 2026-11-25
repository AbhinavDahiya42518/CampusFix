#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_COMPLAINTS 500
#define DATA_FILE "complaints.dat"
#define ADMIN_PIN "2468"

typedef struct {
    int id;
    char name[50];
    char category[30];
    char location[60];
    char description[200];
    int priority;
    int status;
    int votes;
    time_t createdAt;
} Complaint;

Complaint complaints[MAX_COMPLAINTS];
int complaintCount = 0;
int nextId = 1001;

// ---------- INPUT FUNCTIONS ----------

void readLine(const char *prompt, char *buffer, int size) {
    printf("%s", prompt);

    if (fgets(buffer, size, stdin) == NULL) {
        buffer[0] = '\0';
        return;
    }

    size_t len = strlen(buffer);

    if (len > 0 && buffer[len - 1] == '\n') {
        buffer[len - 1] = '\0';
    } else {
        int ch;
        while ((ch = getchar()) != '\n' && ch != EOF) {}
    }
}

int readInt(const char *prompt, int min, int max) {
    char input[50];
    char *end;
    long value;

    while (1) {
        readLine(prompt, input, sizeof(input));

        value = strtol(input, &end, 10);

        if (end != input) {
            while (*end == ' ' || *end == '\t') {
                end++;
            }

            if (*end == '\0' && value >= min && value <= max) {
                return (int)value;
            }
        }

        printf("Invalid choice. Enter a number from %d to %d.\n",
               min, max);
    }
}

// ---------- DISPLAY FUNCTIONS ----------

const char *getStatus(int status) {
    switch (status) {
        case 0: return "PENDING";
        case 1: return "IN PROGRESS";
        case 2: return "RESOLVED";
        default: return "UNKNOWN";
    }
}

const char *getPriority(int priority) {
    switch (priority) {
        case 1: return "LOW";
        case 2: return "MEDIUM";
        case 3: return "HIGH";
        case 4: return "CRITICAL";
        default: return "UNKNOWN";
    }
}

void printLine(void) {
    printf("====================================================\n");
}

void displayComplaint(Complaint c) {
    char date[30] = "Unknown";
    struct tm *timeInfo = localtime(&c.createdAt);

    if (timeInfo != NULL) {
        strftime(date, sizeof(date), "%d-%m-%Y %H:%M",
                 timeInfo);
    }

    printLine();
    printf(" COMPLAINT ID : CF-%d\n", c.id);
    printf(" STUDENT      : %s\n", c.name);
    printf(" CATEGORY     : %s\n", c.category);
    printf(" LOCATION     : %s\n", c.location);
    printf(" DESCRIPTION  : %s\n", c.description);
    printf(" PRIORITY     : %s\n", getPriority(c.priority));
    printf(" STATUS       : %s\n", getStatus(c.status));
    printf(" COMMUNITY VOTES: %d\n", c.votes);
    printf(" REPORTED ON  : %s\n", date);
    printLine();
}

// ---------- FILE STORAGE ----------

void saveData(void) {
    FILE *file = fopen(DATA_FILE, "wb");

    if (file == NULL) {
        printf("Error: Could not save complaint data.\n");
        return;
    }

    fwrite(&complaintCount, sizeof(int), 1, file);
    fwrite(&nextId, sizeof(int), 1, file);
    fwrite(complaints, sizeof(Complaint), complaintCount, file);

    fclose(file);
}

void loadData(void) {
    FILE *file = fopen(DATA_FILE, "rb");

    if (file == NULL) {
        return;
    }

    int storedCount = 0;
    int storedNextId = 1001;

    if (fread(&storedCount, sizeof(int), 1, file) != 1 ||
        fread(&storedNextId, sizeof(int), 1, file) != 1 ||
        storedCount < 0 || storedCount > MAX_COMPLAINTS ||
        storedNextId < 1001) {
        printf("Warning: Invalid data file. Starting fresh.\n");
        fclose(file);
        return;
    }

    Complaint temp[MAX_COMPLAINTS];

    if (fread(temp, sizeof(Complaint), storedCount, file)
        != (size_t)storedCount) {
        printf("Warning: Incomplete data file. Starting fresh.\n");
        fclose(file);
        return;
    }

    memcpy(complaints, temp,
           storedCount * sizeof(Complaint));

    complaintCount = storedCount;
    nextId = storedNextId;

    fclose(file);
}

// ---------- FIND COMPLAINT ----------

int findComplaint(int id) {
    int i;

    for (i = 0; i < complaintCount; i++) {
        if (complaints[i].id == id) {
            return i;
        }
    }

    return -1;
}

// ---------- STUDENT FEATURES ----------

void reportIssue(void) {
    if (complaintCount >= MAX_COMPLAINTS) {
        printf("Complaint storage is full.\n");
        return;
    }

    Complaint c = {0};

    printLine();
    printf("          REPORT A CAMPUS ISSUE\n");
    printLine();

    readLine("Student name: ", c.name, sizeof(c.name));
    readLine("Campus location: ", c.location,
             sizeof(c.location));
    readLine("Describe the issue: ", c.description,
             sizeof(c.description));

    if (strlen(c.name) == 0 ||
        strlen(c.location) == 0 ||
        strlen(c.description) == 0) {
        printf("All fields are required.\n");
        return;
    }

    printf("\nSELECT ISSUE CATEGORY\n");
    printf("1. Electricity\n");
    printf("2. Water Supply\n");
    printf("3. Wi-Fi / Internet\n");
    printf("4. Cleanliness\n");
    printf("5. Infrastructure\n");
    printf("6. Classroom Facilities\n");
    printf("7. Other\n");

    int category = readInt("Select category: ", 1, 7);

    const char *categories[] = {
        "", "Electricity", "Water Supply", "Wi-Fi / Internet",
        "Cleanliness", "Infrastructure",
        "Classroom Facilities", "Other"
    };

    strcpy(c.category, categories[category]);

    printf("\nSELECT PRIORITY\n");
    printf("1. Low\n");
    printf("2. Medium\n");
    printf("3. High\n");
    printf("4. Critical\n");

    c.priority = readInt("Select priority: ", 1, 4);

    c.id = nextId++;
    c.status = 0;
    c.votes = 0;
    c.createdAt = time(NULL);

    complaints[complaintCount++] = c;

    saveData();

    printf("\nISSUE REGISTERED SUCCESSFULLY!\n");
    printf("Your Complaint ID: CF-%d\n", c.id);
    printf("Keep this ID to track your complaint.\n");
}

void trackComplaint(void) {
    int id = readInt("Enter complaint ID (without CF-): ",
                     1001, 999999999);

    int index = findComplaint(id);

    if (index == -1) {
        printf("Complaint not found.\n");
        return;
    }

    printf("\n          COMPLAINT TRACKING\n");
    displayComplaint(complaints[index]);
}

void supportComplaint(void) {
    int id = readInt("Enter complaint ID (without CF-): ",
                     1001, 999999999);

    int index = findComplaint(id);

    if (index == -1) {
        printf("Complaint not found.\n");
        return;
    }

    complaints[index].votes++;

    saveData();

    printf("Thank you! Your support has been recorded.\n");
    printf("Total supporters: %d\n",
           complaints[index].votes);
}

// ---------- ADMIN FEATURES ----------

int adminLogin(void) {
    char pin[30];

    readLine("Enter demo admin PIN: ", pin, sizeof(pin));

    if (strcmp(pin, ADMIN_PIN) == 0) {
        printf("Admin access granted.\n");
        return 1;
    }

    printf("Incorrect PIN.\n");
    return 0;
}

void viewAllComplaints(void) {
    int i;

    if (complaintCount == 0) {
        printf("No complaints registered yet.\n");
        return;
    }

    printf("\n          ALL REGISTERED COMPLAINTS\n");

    for (i = 0; i < complaintCount; i++) {
        displayComplaint(complaints[i]);
    }
}

void updateComplaint(void) {
    int id = readInt("Enter complaint ID (without CF-): ",
                     1001, 999999999);

    int index = findComplaint(id);

    if (index == -1) {
        printf("Complaint not found.\n");
        return;
    }

    printf("\n1. Pending\n");
    printf("2. In Progress\n");
    printf("3. Resolved\n");

    int status = readInt("Select new status: ", 1, 3);

    complaints[index].status = status - 1;

    saveData();

    printf("Complaint status updated successfully!\n");
}

void updatePriority(void) {
    int id = readInt("Enter complaint ID (without CF-): ",
                     1001, 999999999);

    int index = findComplaint(id);

    if (index == -1) {
        printf("Complaint not found.\n");
        return;
    }

    printf("\n1. Low\n2. Medium\n3. High\n4. Critical\n");

    complaints[index].priority =
        readInt("Select new priority: ", 1, 4);

    saveData();

    printf("Priority updated successfully!\n");
}

void showStatistics(void) {
    int pending = 0;
    int progress = 0;
    int resolved = 0;
    int i;

    for (i = 0; i < complaintCount; i++) {
        switch (complaints[i].status) {
            case 0: pending++; break;
            case 1: progress++; break;
            case 2: resolved++; break;
        }
    }

    printLine();
    printf("          CAMPUSFIX ANALYTICS\n");
    printLine();

    printf("Total complaints : %d\n", complaintCount);
    printf("Pending          : %d\n", pending);
    printf("In Progress      : %d\n", progress);
    printf("Resolved         : %d\n", resolved);

    if (complaintCount > 0) {
        printf("Resolution rate  : %.2f%%\n",
               (resolved * 100.0) / complaintCount);
    } else {
        printf("Resolution rate  : 0.00%%\n");
    }

    printLine();
}

void adminDashboard(void) {
    if (!adminLogin()) {
        return;
    }

    int choice;

    do {
        printf("\n");
        printLine();
        printf("             ADMIN CONTROL CENTER\n");
        printLine();

        printf("1. View All Complaints\n");
        printf("2. Update Complaint Status\n");
        printf("3. Change Complaint Priority\n");
        printf("4. View Analytics\n");
        printf("5. Logout\n");

        choice = readInt("Enter choice: ", 1, 5);

        switch (choice) {
            case 1: viewAllComplaints(); break;
            case 2: updateComplaint(); break;
            case 3: updatePriority(); break;
            case 4: showStatistics(); break;
            case 5: printf("Admin logged out.\n"); break;
        }

    } while (choice != 5);
}

// ---------- MAIN MENU ----------

int main(void) {
    int choice;

    loadData();

    printf("\n");
    printLine();
    printf("                 CAMPUSFIX\n");
    printf("       SMART CAMPUS MANAGEMENT SYSTEM\n");
    printLine();
    printf("              SYSTEM ONLINE\n");

    do {
        printf("\n");
        printLine();
        printf("                  MAIN MENU\n");
        printLine();

        printf("1. Report a Campus Issue\n");
        printf("2. Track Complaint\n");
        printf("3. Support an Existing Complaint\n");
        printf("4. Admin Dashboard\n");
        printf("5. View Public Statistics\n");
        printf("6. Exit\n");

        choice = readInt("\nEnter your choice: ", 1, 6);

        switch (choice) {
            case 1:
                reportIssue();
                break;

            case 2:
                trackComplaint();
                break;

            case 3:
                supportComplaint();
                break;

            case 4:
                adminDashboard();
                break;

            case 5:
                showStatistics();
                break;

            case 6:
                saveData();
                printf("\nThank you for using CampusFix!\n");
                printf("Have a better campus experience.\n");
                break;
        }

    } while (choice != 6);

    return 0;
}