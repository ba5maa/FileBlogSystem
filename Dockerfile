FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Stage 1: Build the application
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src
COPY ["FileBlogSystem/FileBlogSystem.csproj", "/FileBlogSystem"]
RUN dotnet restore "./FileBlogSystem/FileBlogSystem..csproj"
COPY . .
RUN dotnet publish "./FileBlogSystem/FileBlogSystem.csproj" -c Release -o /app/publish


FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
