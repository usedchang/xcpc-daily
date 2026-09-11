#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n;string s;
    cin>>n>>s;
    s="&"+s;
    string t="&spbsu";
    vector<int>u(n+2,2*n+1);
    vector<int>su(n+2,2*n+1);
    for(int i=n;i>=1;i--){
        if(s[i]=='u') u[i]=min(i,u[i+1]);
        else u[i]=u[i+1];
        if(s[i]=='s'&&u[i+1]!=2*n+1) su[i]=i+u[i+1];
        else su[i]=su[i+1];
    }
    ll S=0,SP=0;
    ll ans=INF;
    for(int i=1;i<=n;i++){
        if(s[i]=='s') S=i;
        else if(S!=0&&s[i]=='p') SP=S+i;
        if(SP!=0&&su[i]!=2*n+1&&s[i]=='b') {
            ans=min(ans,-SP+su[i]-6LL);
        }
    }
    cout<<ans<<endl;
    return 0;
}